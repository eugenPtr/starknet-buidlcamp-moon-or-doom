use snforge_std::{
    declare, ContractClassTrait, start_cheat_block_timestamp_global,
    start_cheat_caller_address_global
};
use moon_or_doom::{RoundState, Bet, IMoonOrDoomDispatcher, IMoonOrDoomDispatcherTrait};
use starknet::{contract_address_const};

// Helper function to deploy the contract
fn deploy_contract() -> IMoonOrDoomDispatcher {
    let contract = declare("MoonOrDoom").unwrap();
    let (contract_address, _) = contract.deploy(@array![]).unwrap();

    IMoonOrDoomDispatcher { contract_address }
}

// ======================================================
// 21 Sept Deliverables Tests
// ======================================================

#[test]
fn start_round_when_no_active_round_should_create_round() {
    let mut contract = deploy_contract();
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
    let mut contract = deploy_contract();
    let start_price: u128 = 1000;

    contract.start_round(start_price);
    contract.start_round(start_price); // This should panic
}

#[test]
fn end_round_when_active_round_should_end_round() {
    let mut contract = deploy_contract();
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
    let mut contract = deploy_contract();
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
    let mut contract = deploy_contract();
    let end_price: u128 = 1500;

    // Attempt to end a round without starting one first
    contract.end_round(end_price); // This should panic
}

#[test]
fn bet_when_active_round_should_place_bet() {
    let mut contract = deploy_contract();
    let start_price: u128 = 1000;
    let caller = contract_address_const::<1>();

    // Start a round
    contract.start_round(start_price);

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
    let mut contract = deploy_contract();
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
    let mut contract = deploy_contract();
    let caller = contract_address_const::<1>();

    // Attempt to place a bet without starting a round
    start_cheat_caller_address_global(caller);
    contract.bet(Bet::MOON); // This should panic
}

#[test]
fn get_round_info_should_return_correct_details() {
    let mut contract = deploy_contract();
    let start_price: u128 = 1000;
    let end_price: u128 = 1500;

    // Start a round
    start_cheat_block_timestamp_global(100);
    contract.start_round(start_price);

    // Get round info
    let (round_count, state, start_timestamp, end_timestamp, round_start_price, round_end_price) =
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
    let (round_count, state, start_timestamp, end_timestamp, round_start_price, round_end_price) =
        contract
        .get_round_info();

    // Assert updated details
    assert(state == RoundState::Ended, 'Round state should be Ended');
    assert(end_timestamp == 200, 'End timestamp should be set');
    assert(round_end_price == end_price, 'End price should match');
}

#[test]
#[should_panic()]
fn get_round_info_when_no_rounds_have_been_created_should_panic() {
    let contract = deploy_contract();

    // Attempt to get round info when no rounds have been created
    contract.get_round_info(); // This should panic
}

#[test]
fn get_bet_info_should_return_correct_details() {
    let mut contract = deploy_contract();
    let caller = contract_address_const::<1>();
    let start_price: u128 = 1000;

    // Start a round
    contract.start_round(start_price);

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
fn get_bet_info_when_bet_does_not_exist_should_panic() {
    let contract = deploy_contract();
    let caller = contract_address_const::<1>();

    // Attempt to get bet info when no bets have been placed
    // This should panic
    contract.get_bet_info(caller, 1);
}
