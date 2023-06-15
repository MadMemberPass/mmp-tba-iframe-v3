"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { NftContract } from "alchemy-sdk";
import useSWR from "swr";
import { isNil } from "lodash";
import {
  getAccount,
  getAccountStatus,
  getLensNfts,
  getNfts,
  handleNftApprovals,
} from "@/lib/utils";
import { rpcClient } from "@/lib/clients";
import { Exclamation, TbLogo } from "@/components/icon";
import { Tooltip } from "@/components/ui";
import { useNft } from "@/lib/hooks";
import { TbaOwnedNft, TokenInfo } from "@/lib/types";
import { TokenBar } from "./TokenBar";

export default function Token({ params }: { params: { id: string } }) {
  const [imagesLoaded, setImagesLoaded] = useState(false);
  // incase this setting isLocked fails we set null to maybe show a diff state.
  const [nfts, setNfts] = useState<TbaOwnedNft[]>([]);
  const [lensNfts, setLensNfts] = useState<TbaOwnedNft[]>([]);
  const [nftApprovalStatus, setNftApprovalStatus] = useState<
    {
      contract: string | NftContract;
      hasApprovals?: boolean;
      tokenId: string;
    }[]
  >();

  const [tokenInfoTooltip, setTokenInfoTooltip] = useState(false);

  const tokenId = params.id;

  const { data: nftData } = useNft({
    tokenId: parseInt(tokenId as string),
  });

  let nftDataArray: string[] = [];
  if (nftData && Array.isArray(nftData)) nftDataArray = nftData;
  if (nftData && !Array.isArray(nftData)) nftDataArray = [nftData];

  useEffect(() => {
    if (nftData !== null) {
      const imagePromises = nftDataArray.map((src: string) => {
        return new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = resolve;
          image.onerror = reject;
          image.src = src;
        });
      });

      Promise.all(imagePromises)
        .then(() => {
          setImagesLoaded(true);
        })
        .catch((error) => {
          console.error("Error loading images:", error);
        });
    }
  }, [nftData]);

  const { data: account } = useSWR(tokenId ? `/account/${tokenId}` : null, async () => {
    const result = await getAccount(Number(tokenId));
    return result.data;
  });

  const { data: accountBytecode } = useSWR(
    account ? `/account/${account}/bytecode` : null,
    async () => rpcClient.getBytecode({ address: account as `0x${string}` })
  );

  const { data: isLocked } = useSWR(account ? `/account/${account}/locked` : null, async () => {
    if (!accountBytecode || accountBytecode?.length <= 2) {
      return false;
    }

    const { data, error } = await getAccountStatus(account!);

    return data ?? false;
  });

  useEffect(() => {
    async function fetchNfts(account: string) {
      const data = await getNfts(account);
      const lensData = await getLensNfts(account);

      if (data) {
        setNfts(data);
      }
      if (lensData) {
        setLensNfts(lensData);
      }
    }

    if (account) {
      fetchNfts(account);
    }
  }, [account, accountBytecode]);

  useEffect(() => {
    async function getApprovals(nfts: TbaOwnedNft[], account: string) {
      if (!accountBytecode || accountBytecode?.length <= 2) {
        return;
      }

      const approvals = await handleNftApprovals(nfts, account);

      if (approvals) {
        setNftApprovalStatus(approvals);
      }
    }

    if (nfts.length && account) {
      getApprovals(nfts, account);
    }
  }, [nfts, account, accountBytecode]);

  const [tokens, setTokens] = useState<TbaOwnedNft[]>([]);

  useEffect(() => {
    if (nfts !== undefined && nfts.length) {
      nfts.map((token) => {
        const foundApproval = nftApprovalStatus?.find(
          (item) => item.contract === token.contract.address && item.tokenId === token.tokenId
        );

        token.hasApprovals = foundApproval?.hasApprovals || false;
      });
      setTokens(nfts);
      if (lensNfts) {
        setTokens([...nfts, ...lensNfts]);
      }
    }
  }, [nfts, nftApprovalStatus]);

  return (
    <div className="w-screen h-screen bg-white">
      <div className="relative max-h-screen mx-auto bg-gradient-to-b from-[#ab96d3] via-[#fbaaac] to-[#ffe8c4] max-w-screen aspect-square overflow-hidden">
        <div className="relative w-full h-full">
          {isLocked && (
            <div className="absolute top-0 right-0 z-10 w-16 h-16">
              <Tooltip
                lineOne="This token account is Unlocked or has Approvals."
                lineTwo="Its contents may be removed while listed."
                position="left"
              >
                <Exclamation />
              </Tooltip>
            </div>
          )}
          <TokenBar
            account={account}
            isLocked={isLocked}
            tokenInfoTooltip={tokenInfoTooltip}
            tokens={tokens}
            setTokenInfoTooltip={setTokenInfoTooltip}
          />
          <div className="relative w-full">
            <div
              className={`grid w-full grid-cols-1 grid-rows-1 transition ${
                imagesLoaded ? "" : "blur-xl"
              }`}
            >
              {!isNil(nftData) ? (
                nftDataArray.map((layer: string, i: number) => (
                  <img
                    key={i}
                    src={`${layer}`}
                    alt="Sapienz Token Image"
                    className="col-span-1 col-start-1 row-span-1 row-start-1 translate-x-0"
                  />
                ))
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-[#ab96d3] via-[#fbaaac] to-[#ffe8c4]"></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}