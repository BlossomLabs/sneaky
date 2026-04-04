import hre from "hardhat";
import { parseAbi } from "viem";

const RESOLVER = "0x59DC96E5925B70f88bF1031C70E030779C619bf0";
const CORRECT_SIGNER = "0xbd9B643080a93B9496916456436E1eb69f24fB59";
const CORRECT_URL = "https://sneaky-api.blossom.deno.net/{sender}/{data}.json";

const abi = parseAbi([
  "function setUrl(string _url) external",
  "function setSigners(address[] _signers, bool[] _enabled) external",
  "function url() view returns (string)",
  "function signers(address) view returns (bool)",
]);

async function main() {
  const connection = await hre.network.connect();
  const [client] = await connection.viem.getWalletClients();
  const pub = await connection.viem.getPublicClient();

  console.log(`Wallet: ${client.account.address}`);

  const currentUrl = await pub.readContract({
    address: RESOLVER,
    abi,
    functionName: "url",
  });
  console.log(`Current URL: ${currentUrl}`);

  if (currentUrl !== CORRECT_URL) {
    console.log(`Setting URL → ${CORRECT_URL}`);
    const urlTx = await client.writeContract({
      address: RESOLVER,
      abi,
      functionName: "setUrl",
      args: [CORRECT_URL],
    });
    console.log(`  tx: ${urlTx}`);
    await pub.waitForTransactionReceipt({ hash: urlTx });
    console.log("  confirmed");
  } else {
    console.log("URL already correct, skipping");
  }

  const signerOk = await pub.readContract({
    address: RESOLVER,
    abi,
    functionName: "signers",
    args: [CORRECT_SIGNER],
  });

  if (!signerOk) {
    console.log(`Adding signer ${CORRECT_SIGNER}`);
    const sigTx = await client.writeContract({
      address: RESOLVER,
      abi,
      functionName: "setSigners",
      args: [[CORRECT_SIGNER], [true]],
    });
    console.log(`  tx: ${sigTx}`);
    await pub.waitForTransactionReceipt({ hash: sigTx });
    console.log("  confirmed");
  } else {
    console.log("Signer already registered, skipping");
  }

  console.log("Done!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
