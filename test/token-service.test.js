const { 
    expect 
} = require("chai");
const provider_factory 
    = require('../helpers/provider-factory')
const dex_factory 
    = require('../helpers/dex-factory')
const token_factory 
    = require('../helpers/token-factory')
const token_service 
    = require('../helpers/token-service')

describe("token service", () => {

    let provider;
    let dex_1;
    let dex_2;
    let main_token;
    let interim_token;

    beforeEach(async () => {
        provider = 
            await provider_factory.getProvider();
        dex_1 = 
            dex_factory.getDex1(provider);
        dex_2 =
            dex_factory.getDex2(provider);
        main_token =
            await token_factory.getMainToken(provider);
        interim_token = 
            await token_factory.getInterimToken(provider);
    });

    it("should load all dependencies", async () => {
        expect(provider).to.not.be.null;
        expect(dex_1).to.not.be.null;
        expect(dex_2).to.not.be.null;
        expect(main_token).to.not.be.null;
        expect(interim_token).to.not.be.null;
    })

    describe("getPairContract", async () => {

        it("should return existing contract on dex 1", async() => {
            const pair_contract = 
                await token_service.getPairContract(
                    dex_1.Factory, 
                    main_token.address, 
                    interim_token.address, 
                    provider
                )
        
            const contract_token_0 = await pair_contract.token0();
            const contract_token_1 = await pair_contract.token1();

            expect(pair_contract.address.length)
                .to.be.greaterThan(3);
            expect(contract_token_0.length)
                .to.be.greaterThan(3);
            expect(contract_token_1.length)
                .to.be.greaterThan(3);
        })

        it("should return existing contract on dex 2", async() => {
            const pair_contract = 
                await token_service.getPairContract(
                    dex_2.Factory, 
                    main_token.address, 
                    interim_token.address, 
                    provider
                )
        
            const contract_token_0 = await pair_contract.token0();
            const contract_token_1 = await pair_contract.token1();

            expect(pair_contract.address.length)
                .to.be.greaterThan(3);
            expect(contract_token_0.length)
                .to.be.greaterThan(3);
            expect(contract_token_1.length)
                .to.be.greaterThan(3);
        })

        it("should return different contracts for both dexes", async() => {
            const dex_1_pair_contract = 
                await token_service.getPairContract(
                    dex_1.Factory, 
                    main_token.address, 
                    interim_token.address, 
                    provider
                )
            
            const dex_2_pair_contract = 
                await token_service.getPairContract(
                    dex_2.Factory, 
                    main_token.address, 
                    interim_token.address, 
                    provider
                )

            expect(dex_1_pair_contract.address)
                .to.not.equal(dex_2_pair_contract.address); 
        })
    })

    describe("getTokenIndexInsidePair", async () => {

        it("should get the correct token index", async () => {

            // arrange
            const token_0_address = main_token.address;
            const token_1_address = interim_token.address;
            const pair_contract = 
                await token_service.getPairContract(
                    dex_1.Factory, 
                    token_0_address, 
                    token_1_address, 
                    provider
                )
            
            // act
            const token_0_index = 
                await token_service.getTokenIndexInsidePair(
                    pair_contract, 
                    token_0_address);
            const token_1_index = 
                await token_service.getTokenIndexInsidePair(
                    pair_contract, 
                    token_1_address);
            
            // assert
            expect(token_0_index)
                .to.equal(1)
            expect(token_1_index)
                .to.equal(0)
        })

        it("should throw an error when there's no match", async () => {
            const token_0_address = "aaa";
            const pair_contract = 
                await token_service.getPairContract(
                    dex_2.Factory, 
                    main_token.address, 
                    interim_token.address, 
                    provider)
            let error_happened = false;

            try{
                await token_service.getTokenIndexInsidePair(
                    pair_contract, 
                    token_0_address)
            }catch(err){
                error_happened = true;
                expect(err)
                    .to.not.be.null;
            }

            expect(error_happened)
                .to.equal(true)
        });
    })

    describe("determinePotentialTradeOrder", async () => {

        it("should correctly determine the order", async () => {
           
            expect(1)
                .to.equal(2)
        })
    })

})