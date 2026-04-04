import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("OffchainResolverModule", (m) => {
  const url = m.getParameter("url");
  const signers = m.getParameter("signers");
  const resolver = m.contract("OffchainResolver", [url, signers]);
  return { resolver };
});
