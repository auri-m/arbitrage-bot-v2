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

    describe("getPairContract", async () => {

        it("should return a token pair", async () => {
            const pair_contract = 
                await token_service.getPairContract(
                    dex_1.Factory, 
                    main_token.address, 
                    interim_token.address, 
                    provider
                )
        
            expect(pair_contract.address.length)
                .to.be.greaterThan(3);
        })

        it("should return the same pair regardless of the token order", async () => {
            const pair_contract_1 = 
                await token_service.getPairContract(
                    dex_1.Factory, 
                    main_token.address, 
                    interim_token.address, 
                    provider
                )
            // change the token order
            const pair_contract_2 = 
                await token_service.getPairContract(
                    dex_1.Factory, 
                    interim_token.address, 
                    main_token.address, 
                    provider
                )
            
            // the pair address should still the same
            expect(pair_contract_1.address)
                .to.equal(pair_contract_2.address)
        });
    })

    describe("determinePotentialTradeOrder", async () => {
        [
            {
                min_percentage: 5,
                current_percentage: 10,
                expected_dex_to_buy: "QuickswapV2",
                expected_dex_to_sell: "SushiSwapV2"
            },
            {
                min_percentage: 5,
                current_percentage: 5,
                expected_dex_to_buy: "QuickswapV2",
                expected_dex_to_sell: "SushiSwapV2"
            },
            {
                min_percentage: 5,
                current_percentage: -10,
                expected_dex_to_buy: "SushiSwapV2",
                expected_dex_to_sell: "QuickswapV2"
            },
            {
                min_percentage: 5,
                current_percentage: -5,
                expected_dex_to_buy: "SushiSwapV2",
                expected_dex_to_sell: "QuickswapV2"
            }
        ].forEach((x) => {
            const header = `should correctly determine the trade order for: 
                min: ${x.min_percentage} 
                current: ${x.current_percentage}
                dex to buy: ${x.expected_dex_to_buy}
                dex to sell: ${x.expected_dex_to_sell}`

            it(header, async () => {

                const {
                    TradeOrderAvailable,
                    DexToBuy,
                    DexToSell
                } = await token_service.determinePotentialTradeOrder(
                    x.current_percentage,
                    x.min_percentage,
                    dex_1,
                    dex_2
                )

                expect(TradeOrderAvailable)
                    .to.equal(true)
                expect(DexToBuy.Name)
                    .to.equal(x.expected_dex_to_buy)
                expect(DexToSell.Name)
                    .to.equal(x.expected_dex_to_sell)
            });
        });
        
    })

})