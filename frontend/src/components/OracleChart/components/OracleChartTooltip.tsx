import { HStack, Stack } from "@chakra-ui/react";
import { useTranslation } from "next-i18next";
import { ArrowUpRightIcon, Text } from "@looksrare/uikit";
import { formatNumberToLocale, formatUsd } from "@looksrare/utils";
import { MoDRoundFragment } from "@looksrare/yolo-games-gql-typegen";
import { getPriceChangeColors } from "../../../utils/getPriceChangeColor";
import { getFormattedPriceChange } from "../../../utils/getFormattedPriceChange";

interface OracleChartTooltipProps {
  round: MoDRoundFragment;
}

export const OracleChartTooltip = ({ round }: OracleChartTooltipProps) => {
  const { t } = useTranslation();
  const { onChainId, lockPrice, closePrice, result } = round;

  const lockPriceFloat = lockPrice ? Number(lockPrice) : 0;
  const closePriceFloat = closePrice ? Number(closePrice) : 0;

  const priceChange = closePriceFloat - lockPriceFloat;

  const priceChangeDisplay = priceChange ? getFormattedPriceChange(priceChange) : "-";
  const lockPriceDisplay = lockPriceFloat ? formatUsd(lockPriceFloat) : "-";
  const closePriceDisplay = closePriceFloat ? formatUsd(closePriceFloat) : "-";
  const payoutRatioDisplay = result?.payoutRatio ? formatNumberToLocale(result.payoutRatio) : "-";

  const { color } = getPriceChangeColors(priceChange);

  return (
    <Stack spacing={2} minWidth="148px">
      <Text textStyle="helper" color="text-03">
        {t("mod::Rnd")}. #{onChainId.toString()}
      </Text>

      <Stack spacing={2} ml={2}>
        <HStack justifyContent="space-between">
          <Text textStyle="detail" color="text-03">
            {t("Open")}
          </Text>
          <Text textStyle="detail" color="text-01" bold>
            {lockPriceDisplay}
          </Text>
        </HStack>
        <HStack justifyContent="space-between">
          <Text textStyle="detail" color="text-03">
            {t("Close")}
          </Text>
          <Text textStyle="detail" color="text-01" bold>
            {closePriceDisplay}
          </Text>
        </HStack>
        <HStack justifyContent="space-between">
          <Text textStyle="detail" color="text-03">
            {t("mod::Chg")}
          </Text>
          <Text textStyle="detail" color={color} bold>
            {result?.result !== "HOUSE" ? priceChangeDisplay : "-"}
          </Text>
        </HStack>
        <HStack justifyContent="space-between">
          <Text textStyle="detail" color="text-03">
            {t("Payout")}
          </Text>
          <HStack spacing="0.5">
            <Text textStyle="detail" color={color} bold>
              {result?.result !== "HOUSE" ? payoutRatioDisplay : "-"}
            </Text>
            {result?.result !== "HOUSE" && (
              <ArrowUpRightIcon
                boxSize={5}
                color={color}
                transform={priceChange < 0 ? "rotate(90deg)" : "rotate(0deg)"}
              />
            )}
          </HStack>
        </HStack>
      </Stack>
    </Stack>
  );
};
