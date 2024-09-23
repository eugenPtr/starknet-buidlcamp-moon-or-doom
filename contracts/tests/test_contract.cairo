use snforge_std::{declare, ContractClassTrait};
use moon_or_doom::contract::IMoonOrDoomDispatcher;
use starknet::ContractAddress;

// Helper function to deploy the contract
fn deploy_contracts() -> (IMoonOrDoomDispatcher, ContractAddress) {
    let contract = declare("ERC20Mock").unwrap();
    let (STRK_MOCK_ADDRESS, _) = contract.deploy(@array![]).unwrap();

    let contract = declare("MoonOrDoom").unwrap();
    let (contract_address, _) = contract.deploy(@array![STRK_MOCK_ADDRESS.into()]).unwrap();

    (IMoonOrDoomDispatcher { contract_address }, STRK_MOCK_ADDRESS)
}

mod start_round_tests {
    use super::deploy_contracts;
    use snforge_std::start_cheat_block_timestamp_global;
    use moon_or_doom::contract::{RoundState, IMoonOrDoomDispatcherTrait};
    use moon_or_doom::contract::MoonOrDoom::{RoundStarted, Event};
    use snforge_std::{spy_events, EventSpyAssertionsTrait};

    #[test]
    fn start_round_when_no_active_round_should_create_round() {
        let (contract, _) = deploy_contracts();
        let start_price: u128 = 1000;

        start_cheat_block_timestamp_global(100);
        contract.start_round(start_price);

        let (_, state, start_timestamp, _, round_start_price, _) = contract.get_round_info();
        assert(state == RoundState::Active, 'Round should be active');
        assert(start_timestamp != 0, 'Start timestamp should be set');
        assert(round_start_price == start_price, 'Start price should match');
    }

    #[test]
    #[should_panic(expected: ('Round is already active',))]
    fn start_round_when_active_round_should_panic() {
        let (contract, _) = deploy_contracts();
        let start_price: u128 = 1000;

        contract.start_round(start_price);
        contract.start_round(start_price); // This should panic
    }

    #[test]
    fn start_round_should_emit_event() {
        let (contract, _) = deploy_contracts();
        let start_price: u128 = 1000;
        let mut spy = spy_events();

        start_cheat_block_timestamp_global(100);

        let expected_event = Event::RoundStarted(
            RoundStarted { index: 1, start_price: start_price, start_timestamp: 100, }
        );
        contract.start_round(start_price);
        spy.assert_emitted(@array![(contract.contract_address, expected_event)]);
    }
}

mod end_round_tests {
    use super::deploy_contracts;
    use starknet::contract_address_const;
    use snforge_std::{
        start_cheat_block_timestamp_global, start_mock_call, start_cheat_caller_address_global
    };
    use moon_or_doom::contract::{Bet, RoundState, IMoonOrDoomDispatcherTrait};
    use moon_or_doom::contract::MoonOrDoom::{RoundEnded, Event};
    use snforge_std::{spy_events, EventSpyAssertionsTrait};

    #[test]
    fn end_round_when_active_round_should_end_round() {
        let (contract, _) = deploy_contracts();
        let start_price: u128 = 1000;
        let end_price: u128 = 1500;

        start_cheat_block_timestamp_global(100);
        contract.start_round(start_price);
        start_cheat_block_timestamp_global(200);
        contract.end_round(end_price);

        let (_, state, _, end_timestamp, _, round_end_price) = contract.get_round_info();
        assert(state == RoundState::Ended, 'Round should be ended');
        assert(end_timestamp != 0, 'End timestamp should be set');
        assert(round_end_price == end_price, 'End price should match');
    }

    #[test]
    #[should_panic(expected: ('No active round to end',))]
    fn end_round_when_no_active_round_should_panic() {
        let (contract, _) = deploy_contracts();
        let start_price: u128 = 1000;
        let end_price: u128 = 1500;

        start_cheat_block_timestamp_global(100);
        contract.start_round(start_price);
        start_cheat_block_timestamp_global(200);
        contract.end_round(end_price);
        contract.end_round(end_price); // This should panic
    }

    #[test]
    #[should_panic()]
    fn end_round_when_no_rounds_have_been_created_should_panic() {
        let (contract, _) = deploy_contracts();
        let end_price: u128 = 1500;

        // Attempt to end a round without starting one first
        contract.end_round(end_price); // This should panic
    }

    #[test]
    fn end_round_should_emit_event() {
        let (contract, strk_mock_address) = deploy_contracts();
        let start_price: u128 = 1000;
        let end_price: u128 = 1500;
        let mut spy = spy_events();

        start_cheat_block_timestamp_global(100);
        contract.start_round(start_price);
        start_cheat_block_timestamp_global(200);

        let caller = contract_address_const::<1>();
        start_mock_call(
            strk_mock_address,
            selector!("allowance"),
            array![u256 { low: 0xffffffffffffffff, high: 0xffffffffffffffff }]
        );
        start_mock_call(strk_mock_address, selector!("transfer_from"), array![true]);
        start_mock_call(strk_mock_address, selector!("transfer"), array![true]);

        // Place a bet
        start_cheat_caller_address_global(caller);
        contract.bet(Bet::MOON);

        let expected_event = Event::RoundEnded(
            RoundEnded {
                index: 1,
                start_timestamp: 100,
                end_timestamp: 200,
                start_price: start_price,
                end_price: end_price,
                moon_bets_count: 1,
                doom_bets_count: 0,
            }
        );
        contract.end_round(end_price);
        spy.assert_emitted(@array![(contract.contract_address, expected_event)]);
    }
}

mod bet_tests {
    use super::deploy_contracts;
    use snforge_std::{start_cheat_caller_address_global, start_mock_call};
    use snforge_std::{spy_events, EventSpyAssertionsTrait};
    use moon_or_doom::contract::{Bet, IMoonOrDoomDispatcherTrait};
    use moon_or_doom::contract::MoonOrDoom::{BetPlaced, Event};
    use starknet::contract_address_const;

    #[test]
    fn bet_when_active_round_should_place_bet() {
        let (contract, strk_mock_address) = deploy_contracts();
        let start_price: u128 = 1000;
        let caller = contract_address_const::<1>();

        // Start a round
        contract.start_round(start_price);

        start_mock_call(
            strk_mock_address,
            selector!("allowance"),
            array![u256 { low: 0xffffffffffffffff, high: 0xffffffffffffffff }]
        );
        start_mock_call(strk_mock_address, selector!("transfer_from"), array![true]);

        // Place a bet
        start_cheat_caller_address_global(caller);
        contract.bet(Bet::MOON);

        // Check if the bet was placed correctly
        let bet_info = contract.get_bet_info(caller, 1);
        assert(bet_info == Bet::MOON, 'Bet should be placed as MOON');
    }

    #[test]
    #[should_panic(expected: ('Round is not active',))]
    fn bet_when_no_active_round_should_panic() {
        let (contract, _) = deploy_contracts();
        let start_price: u128 = 1000;
        let end_price: u128 = 1500;
        let caller = contract_address_const::<1>();

        // Start and end a round
        contract.start_round(start_price);
        contract.end_round(end_price);

        // Attempt to place a bet after the round has ended
        start_cheat_caller_address_global(caller);
        contract.bet(Bet::DOOM); // This should panic
    }

    #[test]
    #[should_panic()]
    fn bet_when_no_rounds_have_been_created_should_panic() {
        let (contract, _) = deploy_contracts();
        let caller = contract_address_const::<1>();

        // Attempt to place a bet without starting a round
        start_cheat_caller_address_global(caller);
        contract.bet(Bet::MOON); // This should panic
    }

    #[test]
    #[should_panic(expected: ('User already placed a bet',))]
    fn bet_when_user_already_placed_bet_should_panic() {
        let (contract, strk_mock_address) = deploy_contracts();
        let caller = contract_address_const::<1>();
        let start_price: u128 = 1000;

        // Start a round
        contract.start_round(start_price);

        start_mock_call(
            strk_mock_address,
            selector!("allowance"),
            array![u256 { low: 0xffffffffffffffff, high: 0xffffffffffffffff }]
        );
        start_mock_call(strk_mock_address, selector!("transfer_from"), array![true]);

        // Place a bet
        start_cheat_caller_address_global(caller);
        contract.bet(Bet::MOON);

        // Attempt to place another bet in the same round
        contract.bet(Bet::DOOM); // This should panic
    }

    #[test]
    #[should_panic(expected: ('Not enough allowance',))]
    fn bet_when_not_enough_allowance_should_panic() {
        let (contract, _) = deploy_contracts();
        let caller = contract_address_const::<1>();
        let start_price: u128 = 1000;

        // Start a round
        contract.start_round(start_price);

        // Attempt to place a bet without enough allowance
        start_cheat_caller_address_global(caller);
        contract.bet(Bet::MOON); // This should panic
    }

    #[test]
    #[should_panic(expected: ('Failed to transfer STRK',))]
    fn bet_when_transfer_fails_should_panic() {
        let (contract, strk_mock_address) = deploy_contracts();
        let caller = contract_address_const::<1>();
        let start_price: u128 = 1000;

        // Start a round
        contract.start_round(start_price);

        start_mock_call(
            strk_mock_address,
            selector!("allowance"),
            array![u256 { low: 0xffffffffffffffff, high: 0xffffffffffffffff }]
        );
        start_mock_call(strk_mock_address, selector!("transfer_from"), array![false]);

        // Attempt to place a bet
        start_cheat_caller_address_global(caller);
        contract.bet(Bet::MOON); // This should panic
    }

    #[test]
    fn bet_should_emit_event() {
        let (contract, strk_mock_address) = deploy_contracts();
        let caller = contract_address_const::<1>();
        let start_price: u128 = 1000;
        let mut spy = spy_events();

        // Start a round
        contract.start_round(start_price);

        start_mock_call(
            strk_mock_address,
            selector!("allowance"),
            array![u256 { low: 0xffffffffffffffff, high: 0xffffffffffffffff }]
        );
        start_mock_call(strk_mock_address, selector!("transfer_from"), array![true]);

        // Place a bet
        start_cheat_caller_address_global(caller);
        let bet = Bet::MOON;

        let expected_event = Event::BetPlaced(
            BetPlaced { round_index: 1, user: caller, bet: bet, }
        );
        contract.bet(bet);
        spy.assert_emitted(@array![(contract.contract_address, expected_event)]);
    }
}

mod get_round_info_tests {
    use super::deploy_contracts;
    use snforge_std::start_cheat_block_timestamp_global;
    use moon_or_doom::contract::{RoundState, IMoonOrDoomDispatcherTrait};

    #[test]
    fn get_round_info_should_return_correct_details() {
        let (contract, _) = deploy_contracts();
        let start_price: u128 = 1000;
        let end_price: u128 = 1500;

        // Start a round
        start_cheat_block_timestamp_global(100);
        contract.start_round(start_price);

        // Get round info
        let (
            round_count, state, start_timestamp, end_timestamp, round_start_price, round_end_price
        ) =
            contract
            .get_round_info();

        // Assert correct details
        assert(round_count == 1, 'Round count should be 1');
        assert(state == RoundState::Active, 'Round state should be Active');
        assert(start_timestamp == 100, 'Start timestamp should be set');
        assert(end_timestamp == 0, 'End timestamp should be 0');
        assert(round_start_price == start_price, 'Start price should match');
        assert(round_end_price == 0, 'End price should be 0');

        // End the round
        start_cheat_block_timestamp_global(200);
        contract.end_round(end_price);

        // Get updated round info
        let (_, state, _, end_timestamp, _, round_end_price) = contract.get_round_info();

        // Assert updated details
        assert(state == RoundState::Ended, 'Round state should be Ended');
        assert(end_timestamp == 200, 'End timestamp should be set');
        assert(round_end_price == end_price, 'End price should match');
    }

    #[test]
    #[should_panic()]
    fn get_round_info_when_no_rounds_have_been_created_should_panic() {
        let (contract, _) = deploy_contracts();

        // Attempt to get round info when no rounds have been created
        contract.get_round_info(); // This should panic
    }
}

mod get_bet_info_tests {
    use super::deploy_contracts;
    use snforge_std::{start_cheat_caller_address_global, start_mock_call};
    use moon_or_doom::contract::{Bet, IMoonOrDoomDispatcherTrait};
    use starknet::contract_address_const;

    #[test]
    fn get_bet_info_should_return_correct_details() {
        let (contract, strk_mock_address) = deploy_contracts();
        let caller = contract_address_const::<1>();
        let start_price: u128 = 1000;

        // Start a round
        contract.start_round(start_price);

        start_mock_call(
            strk_mock_address,
            selector!("allowance"),
            array![u256 { low: 0xffffffffffffffff, high: 0xffffffffffffffff }]
        );
        start_mock_call(strk_mock_address, selector!("transfer_from"), array![true]);

        // Place a bet
        start_cheat_caller_address_global(caller);
        contract.bet(Bet::MOON);

        // Get bet info
        let bet_info = contract.get_bet_info(caller, 1);

        // Assert correct details
        assert(bet_info == Bet::MOON, 'Bet should be MOON');

        // Place another bet in the same round
        let another_caller = contract_address_const::<2>();
        start_cheat_caller_address_global(another_caller);
        contract.bet(Bet::DOOM);

        // Get bet info for the second caller
        let another_bet_info = contract.get_bet_info(another_caller, 1);

        // Assert correct details for the second bet
        assert(another_bet_info == Bet::DOOM, 'Bet should be DOOM');
    }

    #[test]
    #[should_panic()]
    // TODO: Should return a specific error message
    fn get_bet_info_when_bet_does_not_exist_should_panic() {
        let (contract, _) = deploy_contracts();
        let caller = contract_address_const::<1>();

        // Attempt to get bet info when no bets have been placed
        // This should panic
        contract.get_bet_info(caller, 1);
    }
}
