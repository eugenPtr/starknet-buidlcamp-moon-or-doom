use starknet::contract_address::ContractAddress;

#[derive(Debug, Drop, Copy, Serde, PartialEq, starknet::Store)]
pub enum RoundState {
    Active,
    Ended,
}

#[derive(Debug, Drop, Copy, Serde, PartialEq, starknet::Store)]
pub enum Bet {
    DEFAULT,
    MOON,
    DOOM,
}

#[starknet::interface]
pub trait IMoonOrDoom<TContractState> {
    fn start_round(ref self: TContractState, start_price: u128);
    fn end_round(ref self: TContractState, end_price: u128);
    fn bet(ref self: TContractState, bet: Bet);

    fn get_round_info(self: @TContractState) -> (usize, RoundState, u64, u64, u128, u128);
    fn get_bet_info(self: @TContractState, user: ContractAddress, round_index: usize) -> Bet;
}

#[starknet::contract]
pub mod MoonOrDoom {
    use starknet::contract_address::ContractAddress;
    use starknet::{get_block_timestamp, get_caller_address, get_contract_address};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Vec, MutableVecTrait
    };
    use super::{RoundState, Bet};
    use openzeppelin::token::erc20::interface::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};

    #[derive(Serde, Copy, Drop, starknet::Store)]
    struct Round {
        state: RoundState,
        start_timestamp: u64,
        end_timestamp: u64,
        start_price: u128,
        end_price: u128,
    }

    #[storage]
    struct Storage {
        round_count: usize,
        rounds: Map::<usize, Round>,
        user_bet_in_round: Map::<ContractAddress, Map<usize, Bet>>,
        moon_bets_in_round: Map::<usize, Vec<ContractAddress>>,
        doom_bets_in_round: Map::<usize, Vec<ContractAddress>>,
        strk_contract: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, strk_contract: ContractAddress) {
        self.round_count.write(0);
        self.strk_contract.write(strk_contract);
    }

    #[abi(embed_v0)]
    impl MoonOrDoomImpl of super::IMoonOrDoom<ContractState> {
        fn start_round(ref self: ContractState, start_price: u128) {
            let last_round_index = self.round_count.read();

            // Check if there's an active round
            if last_round_index > 0 {
                let current_round = self.rounds.entry(last_round_index).read();
                assert(current_round.state == RoundState::Ended, 'Round is already active');
            }

            let round = Round {
                state: RoundState::Active,
                start_timestamp: get_block_timestamp(),
                end_timestamp: 0,
                start_price: start_price,
                end_price: 0,
            };

            let new_round_index = last_round_index + 1;

            self.rounds.entry(new_round_index).write(round);
            self.round_count.write(new_round_index);
        }

        fn end_round(ref self: ContractState, end_price: u128) {
            let last_round_index = self.round_count.read();

            let mut round = self.rounds.entry(last_round_index).read();
            assert(round.state == RoundState::Active, 'No active round to end');

            round.state = RoundState::Ended;
            round.end_timestamp = get_block_timestamp();
            round.end_price = end_price;
            self.rounds.entry(last_round_index).write(round);

            // Distribute STRK to winners
            let moon_bets_count = self.moon_bets_in_round.entry(last_round_index).len();
            let doom_bets_count = self.doom_bets_in_round.entry(last_round_index).len();

            let total_bets_count = moon_bets_count + doom_bets_count;

            if total_bets_count == 0 {
                return;
            } else if round.end_price > round.start_price {
                // Moon won
                let moon_reward_per_winner = moon_bets_count / total_bets_count;
                for i in 0..moon_bets_count {
                    let winner_address = self.moon_bets_in_round.entry(last_round_index).at(i).read();
                    let success = ERC20ABIDispatcher{ contract_address: self.strk_contract.read() }.transfer(winner_address, moon_reward_per_winner.into());
                    assert(success, 'Failed to transfer STRK');
                };
            } else if round.end_price < round.start_price {
                // Doom won
                let doom_reward_per_winner = doom_bets_count / total_bets_count;
                for i in 0..doom_bets_count {
                    let winner_address = self.doom_bets_in_round.entry(last_round_index).at(i).read();
                    let success = ERC20ABIDispatcher{ contract_address: self.strk_contract.read() }.transfer(winner_address, doom_reward_per_winner.into());
                    assert(success, 'Failed to transfer STRK');
                };
            }
        }

        fn bet(ref self: ContractState, bet: Bet) {
            let last_round_index = self.round_count.read();
            let round = self.rounds.entry(last_round_index).read();
            let caller = get_caller_address();

            assert(round.state == RoundState::Active, 'Round is not active');

            let allowed_to_transfer = ERC20ABIDispatcher{ contract_address: self.strk_contract.read() }.allowance(caller, get_contract_address());
            assert(allowed_to_transfer >= 1, 'Not enough allowance');

            // Transfer 1 STRK
            let success = ERC20ABIDispatcher{ contract_address: self.strk_contract.read() }.transfer_from(caller, get_contract_address(), 1);
            assert(success, 'Failed to transfer STRK');

            if bet == Bet::MOON {
                self.moon_bets_in_round.entry(last_round_index).append().write(caller);
            } else if bet == Bet::DOOM {
                self.doom_bets_in_round.entry(last_round_index).append().write(caller);
            } else {
                assert(false, 'Invalid bet');
            }

            self.user_bet_in_round.entry(caller).entry(last_round_index.into()).write(bet);
        }

        fn get_round_info(self: @ContractState) -> (usize, RoundState, u64, u64, u128, u128) {
            let last_round_index = self.round_count.read();

            let round = self.rounds.entry(last_round_index).read();

            (
                last_round_index,
                round.state,
                round.start_timestamp,
                round.end_timestamp,
                round.start_price,
                round.end_price
            )
        }

        fn get_bet_info(self: @ContractState, user: ContractAddress, round_index: usize) -> Bet {
            self.user_bet_in_round.entry(user).entry(round_index.into()).read()
        }
    }
}
