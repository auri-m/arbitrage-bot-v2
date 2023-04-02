const { expect } = require("chai");
const provider_factory 
    = require('../helpers/provider-factory')
const token_factory 
    = require('../helpers/token-factory')

describe("token factory", () => {

    let provider;

    beforeEach(async () => {
        provider = 
            await provider_factory.getProvider();
    });

    describe("getMainToken", async () => {

        let main_token;
        const expected_main_token_config_name = "WETH";
        const expected_main_token_config_address = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
        const expected_main_token_contract_address = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
        const expected_main_token_contract_name = "Wrapped Ether";
        const expected_main_token_contract_symbol = "WETH";
        const expected_main_token_decimals = 18;

        beforeEach(async () => {
            main_token = 
                await token_factory.getMainToken(provider);
        });

        it("should return the correct token", async () => {
            expect(main_token.configName)
                .to.equal(expected_main_token_config_name);
            expect(main_token.address)
                .to.equal(expected_main_token_config_address);      
            expect(main_token.contract.address)
                .to.equal(expected_main_token_contract_address); 
            expect(main_token.symbol)
                .to.equal(expected_main_token_contract_symbol); 
            expect(main_token.name)
                .to.equal(expected_main_token_contract_name); 
            expect(main_token.decimals)
                .to.equal(expected_main_token_decimals); 
        });

        it("should return a token with the same contract and config addresses", async () => {
            expect(main_token.address)
                .to.equal(main_token.contract.address); 
        });

        it("should return a token with an existing contract", async () => {
            const token_code = 
                await provider.getCode(main_token.contract.address);

            expect(token_code.length)
                .to.be.greaterThan(3);
        });
    })

    describe("getInterimToken", async () => {

        let interim_token;
        const expected_interim_token_config_name = "CHAINLINK";
        const expected_interim_token_config_address = "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39";
        const expected_interim_token_contract_address = "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39";
        const expected_interim_token_contract_name = "ChainLink Token";
        const expected_interim_token_contract_symbol = "LINK";
        const expected_interim_token_decimals = 18;

        beforeEach(async () => {
            interim_token = 
                await token_factory.getInterimToken(provider);
        });

        it("should return the correct token", async () => {
            expect(interim_token.configName)
                .to.equal(expected_interim_token_config_name);
            expect(interim_token.address)
                .to.equal(expected_interim_token_config_address);      
            expect(interim_token.contract.address)
                .to.equal(expected_interim_token_contract_address); 
            expect(interim_token.symbol)
                .to.equal(expected_interim_token_contract_symbol); 
            expect(interim_token.name)
                .to.equal(expected_interim_token_contract_name);
            expect(interim_token.decimals)
                .to.equal(expected_interim_token_decimals);  
        });

        it("should return a token with the same contract and config addresses", async () => {
            expect(interim_token.address)
                .to.equal(interim_token.contract.address); 
        });

        it("should return a token with an existing contract", async () => {
            const token_code = 
                await provider.getCode(interim_token.contract.address);

            expect(token_code.length)
                .to.be.greaterThan(3);
        });
    })

})