use starknet::contract_address::ContractAddress;

#[derive(Drop, Copy, Serde, PartialEq, starknet::Store)]
pub enum RoundState {
    Active,
    Ended,
}

#[derive(Drop, Copy, Serde, PartialEq, starknet::Store)]
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
mod MoonOrDoom {
    use starknet::contract_address::ContractAddress;
    use starknet::{get_block_timestamp, get_caller_address};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry
    };
    use super::{RoundState, Bet};

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
        bets: Map::<ContractAddress, Map<usize, Bet>>,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.round_count.write(0);
    }

    #[abi(embed_v0)]
    impl MoonOrDoomImpl of super::IMoonOrDoom<ContractState> {
        fn start_round(ref self: ContractState, start_price: u128) {
            let round_count = self.round_count.read();

            // Check if there's an active round
            if round_count > 0 {
                let current_round = self.rounds.entry(round_count).read();
                assert(current_round.state == RoundState::Ended, 'Round is already active');
            }

            let round = Round {
                state: RoundState::Active,
                start_timestamp: get_block_timestamp(),
                end_timestamp: 0,
                start_price: start_price,
                end_price: 0,
            };

            let new_round_index = round_count + 1;

            self.rounds.entry(new_round_index).write(round);
            self.round_count.write(new_round_index);
        }

        fn end_round(ref self: ContractState, end_price: u128) {
            let round_count = self.round_count.read();

            let mut round = self.rounds.entry(round_count).read();
            assert(round.state == RoundState::Active, 'No active round to end');

            round.state = RoundState::Ended;
            round.end_timestamp = get_block_timestamp();
            round.end_price = end_price;
            self.rounds.entry(round_count).write(round);
        }

        fn bet(ref self: ContractState, bet: Bet) {
            let round_count = self.round_count.read();
            let round = self.rounds.entry(round_count).read();
            let caller = get_caller_address();

            assert(round.state == RoundState::Active, 'Round is not active');

            self.bets.entry(caller).entry(round_count.into()).write(bet);
        }

        fn get_round_info(self: @ContractState) -> (usize, RoundState, u64, u64, u128, u128) {
            let round_count = self.round_count.read();

            let round = self.rounds.entry(round_count).read();

            (
                round_count,
                round.state,
                round.start_timestamp,
                round.end_timestamp,
                round.start_price,
                round.end_price
            )
        }

        fn get_bet_info(self: @ContractState, user: ContractAddress, round_index: usize) -> Bet {
            self.bets.entry(user).entry(round_index.into()).read()
        }
    }
}
