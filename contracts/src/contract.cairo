use starknet::contract_address::ContractAddress;

#[derive(Debug, Drop, Copy, Serde, PartialEq, starknet::Store)]
pub enum RoundState {
    Active,
    Ended,
}

#[derive(Debug, Drop, Copy, Serde, PartialEq, starknet::Store)]
pub enum Bet {
    #[default]
    None,
    MOON,
    DOOM,
}

#[starknet::interface]
pub trait IMoonOrDoom<TContractState> {
    fn start_round(ref self: TContractState);
    fn end_round(ref self: TContractState);
    fn bet(ref self: TContractState, bet: Bet);
    fn set_fee_percentage(ref self: TContractState, fee_percentage: u256);
    fn set_round_duration_seconds(ref self: TContractState, round_duration_seconds: u64);
    fn set_betting_duration_seconds(ref self: TContractState, betting_duration_seconds: u64);

    fn get_round_info(self: @TContractState) -> (usize, RoundState, u64, u64, u128, u128);
    fn get_bet_info(self: @TContractState, user: ContractAddress, round_index: usize) -> Bet;
}

#[starknet::contract]
pub mod MoonOrDoom {
    use starknet::contract_address::ContractAddress;
    use starknet::{get_block_timestamp, get_caller_address, get_contract_address};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Vec,
        MutableVecTrait
    };
    use super::{RoundState, Bet};
    use openzeppelin::token::erc20::interface::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
    use openzeppelin::access::ownable::OwnableComponent;
    use pragma_lib::abi::{IPragmaABIDispatcher, IPragmaABIDispatcherTrait};
    use pragma_lib::types::{AggregationMode, DataType, Checkpoint};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    // Ownable Mixin
    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl InternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[derive(Debug, Serde, Copy, Drop, starknet::Store)]
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
        strk_address: ContractAddress,
        oracle_address: ContractAddress,
        fee_percentage: u256,
        round_duration_seconds: u64,
        betting_duration_seconds: u64,

        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RoundStarted: RoundStarted,
        RoundEnded: RoundEnded,
        BetPlaced: BetPlaced,
        #[flat]
        OwnableEvent: OwnableComponent::Event
    }

    #[derive(Drop, starknet::Event)]
    // TODO: Add event #[key] to all events
    pub struct RoundStarted {
        pub index: usize,
        pub start_timestamp: u64,
        pub start_price: u128,
    }

    #[derive(Debug, Drop, starknet::Event)]
    pub struct RoundEnded {
        pub index: usize,
        pub start_timestamp: u64,
        pub end_timestamp: u64,
        pub start_price: u128,
        pub end_price: u128,
        pub moon_bets_count: u64,
        pub doom_bets_count: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BetPlaced {
        pub round_index: usize,
        pub user: ContractAddress,
        pub bet: Bet,
    }

    #[constructor]
    fn constructor(ref self: ContractState, strk_address: ContractAddress, oracle_address: ContractAddress) {
        self.round_count.write(0);
        self.strk_address.write(strk_address);
        self.oracle_address.write(oracle_address);
        self.fee_percentage.write(10);
        self.round_duration_seconds.write(60);
        self.betting_duration_seconds.write(60);

        // Set the initial owner of the contract
        self.ownable.initializer(get_caller_address());
    }

    #[abi(embed_v0)]
    impl MoonOrDoomImpl of super::IMoonOrDoom<ContractState> {
        fn start_round(ref self: ContractState) {
            let last_round_index = self.round_count.read();

            // Check if there's an active round
            if last_round_index > 0 {
                let current_round = self.rounds.entry(last_round_index).read();
                assert(current_round.state == RoundState::Ended, 'Round is already active');
            }

            let time_now = get_block_timestamp();

            let start_price = get_asset_price_median(self.oracle_address.read(), DataType::SpotEntry('STRK/USD'), time_now);

            let round = Round {
                state: RoundState::Active,
                start_timestamp: time_now,
                end_timestamp: time_now + self.round_duration_seconds.read(),
                start_price: start_price,
                end_price: 0,
            };

            let new_round_index = last_round_index + 1;

            self.rounds.entry(new_round_index).write(round);
            self.round_count.write(new_round_index);

            self
                .emit(
                    RoundStarted {
                        index: new_round_index,
                        start_timestamp: get_block_timestamp(),
                        start_price: start_price,
                    }
                );
        }

        fn end_round(ref self: ContractState) {
            let last_round_index = self.round_count.read();

            let mut round = self.rounds.entry(last_round_index).read();
            assert(round.state == RoundState::Active, 'No active round to end');

            let end_price = get_asset_price_median(self.oracle_address.read(), DataType::SpotEntry('STRK/USD'), round.end_timestamp);

            round.state = RoundState::Ended;
            round.end_price = end_price;
            self.rounds.entry(last_round_index).write(round);

            // Distribute STRK to winners
            let moon_bets_count = self.moon_bets_in_round.entry(last_round_index).len();
            let doom_bets_count = self.doom_bets_in_round.entry(last_round_index).len();

            let total_bets_count = moon_bets_count + doom_bets_count;

            if total_bets_count == 0 {
                self.emit(
                    RoundEnded {
                        index: last_round_index,
                        start_timestamp: round.start_timestamp,
                        end_timestamp: round.end_timestamp,
                        start_price: round.start_price,
                        end_price: round.end_price,
                        moon_bets_count: moon_bets_count,
                        doom_bets_count: doom_bets_count,
                    }
                );
                return;
            }

            let fee_amount = total_bets_count.into() * self.fee_percentage.read() / 100;
            let success = ERC20ABIDispatcher { contract_address: self.strk_address.read() }
                .transfer_from(get_contract_address(), self.ownable.owner(), fee_amount);
            assert(success, 'Failed to collect fee');

            match round.end_price >= round.start_price {
                true => {
                    // Moon won
                    let reward_per_winner = (moon_bets_count.into() - fee_amount)
                        / total_bets_count.into();
                    for i in 0
                        ..moon_bets_count {
                            let winner_address = self
                                .moon_bets_in_round
                                .entry(last_round_index)
                                .at(i)
                                .read();
                            let success = ERC20ABIDispatcher {
                                contract_address: self.strk_address.read()
                            }
                                .transfer(winner_address, reward_per_winner);
                            assert(success, 'Failed to transfer STRK');
                        };
                },
                false => {
                    // Doom won
                    let reward_per_winner = (doom_bets_count.into() - fee_amount)
                        / total_bets_count.into();
                    for i in 0
                        ..doom_bets_count {
                            let winner_address = self
                                .doom_bets_in_round
                                .entry(last_round_index)
                                .at(i)
                                .read();
                            let success = ERC20ABIDispatcher {
                                contract_address: self.strk_address.read()
                            }
                                .transfer(winner_address, reward_per_winner);
                            assert(success, 'Failed to transfer STRK');
                        };
                }
            }

            self
                .emit(
                    RoundEnded {
                        index: last_round_index,
                        start_timestamp: round.start_timestamp,
                        end_timestamp: round.end_timestamp,
                        start_price: round.start_price,
                        end_price: round.end_price,
                        moon_bets_count: moon_bets_count,
                        doom_bets_count: doom_bets_count,
                    }
                );
        }

        fn bet(ref self: ContractState, bet: Bet) {
            let last_round_index = self.round_count.read();
            let round = self.rounds.entry(last_round_index).read();
            let caller = get_caller_address();
            let existing_bet = self.user_bet_in_round.entry(caller).entry(last_round_index.into()).read();

            assert(round.state == RoundState::Active, 'Round is not active');
            assert(existing_bet == Bet::None, 'User already bet in this round');
            assert(get_block_timestamp() < round.start_timestamp + self.betting_duration_seconds.read(), 'Betting period is over');

            let allowed_to_transfer = ERC20ABIDispatcher {
                contract_address: self.strk_address.read()
            }
                .allowance(caller, get_contract_address());
            assert(allowed_to_transfer >= 1, 'Not enough allowance');

            // Transfer 1 STRK
            let success = ERC20ABIDispatcher { contract_address: self.strk_address.read() }
                .transfer_from(caller, get_contract_address(), 1);
            assert(success, 'Failed to transfer STRK');

            match bet {
                Bet::MOON => {
                    self.moon_bets_in_round.entry(last_round_index).append().write(caller);
                },
                Bet::DOOM => {
                    self.doom_bets_in_round.entry(last_round_index).append().write(caller);
                },
                _ => {
                    assert(false, 'Invalid bet');
                }
            }

            self.user_bet_in_round.entry(caller).entry(last_round_index.into()).write(bet);

            self.emit(BetPlaced { round_index: last_round_index, user: caller, bet: bet, });
        }

        fn set_fee_percentage(ref self: ContractState, fee_percentage: u256) {
            self.ownable.assert_only_owner();
            self.fee_percentage.write(fee_percentage);
        }

        fn set_round_duration_seconds(ref self: ContractState, round_duration_seconds: u64) {
            self.ownable.assert_only_owner();
            self.round_duration_seconds.write(round_duration_seconds);
        }

        fn set_betting_duration_seconds(ref self: ContractState, betting_duration_seconds: u64) {
            self.ownable.assert_only_owner();
            self.betting_duration_seconds.write(betting_duration_seconds);
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

    fn get_asset_price_median(oracle_address: ContractAddress, asset : DataType, timestamp: u64) -> u128  {
        let oracle_dispatcher = IPragmaABIDispatcher{contract_address : oracle_address};
        let (checkpoint, _index) : (Checkpoint, u64)= oracle_dispatcher.get_last_checkpoint_before(asset, timestamp, AggregationMode::Median(()));
        return checkpoint.value;
    }
}
