import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export function loadKeypair(): Keypair | null {
  const secret = process.env.WALLET_PRIVATE_KEY;
  if (!secret) return null;
  try {
    const bytes = bs58.decode(secret);
    return Keypair.fromSecretKey(bytes);
  } catch {
    return null;
  }
}

export function getPublicKeyBase58(): string | null {
  const kp = loadKeypair();
  return kp ? kp.publicKey.toBase58() : null;
}
