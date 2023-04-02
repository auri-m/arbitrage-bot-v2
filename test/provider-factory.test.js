const { expect } = require("chai");
const provider_factory 
    = require('../helpers/provider-factory')

describe("provider factory", () => {

    describe("getProvider", async () => {

        it("should return provider", async () => {

            const provider = 
                await provider_factory.getProvider();

            const network =
                await provider.getNetwork();

            expect(provider)
                .to.not.be.null;
            expect(network)
                .to.not.be.null;          
        });
    })
})