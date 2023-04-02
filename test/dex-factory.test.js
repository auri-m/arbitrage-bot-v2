const { expect } = require("chai");
const dex_factory 
    = require('../helpers/dex-factory')
const provider_factory 
    = require('../helpers/provider-factory')

describe("dex factory", () => {

    let provider;

    beforeEach(async () => {
        provider = 
            await provider_factory.getProvider();
    });

    describe("getDex1", async () => {

        let dex_1;
        const expected_dex1_name = "QuickswapV2";
        const expected_dex1_router_address = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
        const expected_dex1_factory_address = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";

        beforeEach(async () => {
            dex_1 = 
                dex_factory.getDex1(provider);
        });

        it("should return the correct dex", async () => {
            expect(dex_1.Name).to.equal(expected_dex1_name);
            expect(dex_1.Router.address).to.equal(expected_dex1_router_address);      
            expect(dex_1.Factory.address).to.equal(expected_dex1_factory_address); 
        });

        it("dex router should be an existing contract", async () => {
            const router_code = 
                await provider.getCode(dex_1.Router.address);

            expect(router_code.length).to.be.greaterThan(3);
        });

        it("dex factory should be an existing contract", async () => {
            const factory_code = 
                await provider.getCode(dex_1.Factory.address);

            expect(factory_code.length).to.be.greaterThan(3);
        });
    })

    describe("getDex2", async () => {

        let dex_2;
        const expected_dex2_name = "SushiSwapV2";
        const expected_dex2_router_address = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
        const expected_dex2_factory_address = "0xc35DADB65012eC5796536bD9864eD8773aBc74C4";

        beforeEach(async () => {
            dex_2 = 
                dex_factory.getDex2(provider);
        });

        it("should return the correct dex", async () => {
            expect(dex_2.Name).to.equal(expected_dex2_name);
            expect(dex_2.Router.address).to.equal(expected_dex2_router_address);      
            expect(dex_2.Factory.address).to.equal(expected_dex2_factory_address); 
        });

        it("dex router should be an existing contract", async () => {
            const router_code = 
                await provider.getCode(dex_2.Router.address);

            expect(router_code.length).to.be.greaterThan(3);
        });

        it("dex factory should be an existing contract", async () => {
            const factory_code = 
                await provider.getCode(dex_2.Factory.address);

            expect(factory_code.length).to.be.greaterThan(3);
        });
    })
})