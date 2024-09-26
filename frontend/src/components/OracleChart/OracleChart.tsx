import { useEffect } from "react";
import { Box } from "@chakra-ui/react";
import { HighchartsTooltip, HighchartsTooltipFormatterFunction, XYDataType } from "@looksrare/uikit";
import { formatNumberToLocale } from "@looksrare/utils";
import { subSeconds } from "date-fns/subSeconds";
import { addSeconds } from "date-fns/addSeconds";
import { useTranslation } from "next-i18next";
import { MoDRoundFragment } from "@looksrare/yolo-games-gql-typegen";
import { OracleChartTooltip } from "./components/OracleChartTooltip";
import { OracleChartStyles } from "./components/OracleChartStyles";
import { formatLatestDataPointData, formatPastRoundsData } from "./utils/oracleChartFormatters";
import { useOracleChart } from "./hooks/useOracleChart";
import { useOracleChartZoom } from "./hooks/useOracleChartZoom";

interface OracleChartProps {
  data: XYDataType;
  pastRounds: MoDRoundFragment[];
  currentRound: MoDRoundFragment;
  nextRound: MoDRoundFragment;
}

export const OracleChart = ({ data, pastRounds, currentRound, nextRound }: OracleChartProps) => {
  const { t } = useTranslation();

  const { chartElementRef, highchartsChart } = useOracleChart();
  const zoomLevel = useOracleChartZoom(chartElementRef);

  const latestDataPoint = data[data.length - 1];
  const currentRoundLockPrice = currentRound.lockPrice;
  const xAxis = highchartsChart.current?.xAxis?.[0];
  const yAxis = highchartsChart.current?.yAxis?.[0];

  // Update chart data
  useEffect(() => {
    if (highchartsChart.current?.series) {
      const [liveDataSeries, pastRoundsSeries, latestDataPointSeries] = highchartsChart.current.series;

      liveDataSeries.setData(data);
      pastRoundsSeries.setData(formatPastRoundsData(pastRounds));

      if (latestDataPoint) {
        latestDataPointSeries.setData(formatLatestDataPointData(latestDataPoint));
      }
    }
  }, [data, highchartsChart, latestDataPoint, pastRounds, zoomLevel]);

  // Update chart plot lines
  useEffect(() => {
    // Even though we're checking if xAxis and yAxis exist, somehow highcharts is
    // still throwing an issue about a value inside of them being undefined. Very weird.
    // Unfortunately it's a private value, so i cannot manually check for it, thus the empty try-catch
    try {
      if (xAxis) {
        xAxis.removePlotLine("currentRoundLockTimeX");
        xAxis.removePlotLine("nextRoundLockTimeX");

        xAxis.addPlotLine({
          id: "currentRoundLockTimeX",
          value: new Date(currentRound.lockedAt).getTime(),
          label: {
            text: t("Current"),
            align: "right",
            useHTML: true,
            rotation: 270,
          },
        });

        xAxis.addPlotLine({
          id: "nextRoundLockTimeX",
          value: new Date(nextRound.lockedAt).getTime(),
          label: {
            text: t("End"),
            align: "right",
            useHTML: true,
            rotation: 270,
          },
        });
      }

      if (yAxis) {
        yAxis.removePlotLine("currentRoundLockPriceY");
        yAxis.addPlotLine({
          id: "currentRoundLockPriceY",
          value: Number(currentRoundLockPrice ?? 0),
          label: {
            text: formatNumberToLocale(Number(currentRoundLockPrice ?? 0), 2),
            align: "right",
            useHTML: true,
          },
        });
      }
    } catch {}
  }, [currentRound.lockedAt, currentRoundLockPrice, highchartsChart, nextRound.lockedAt, t, xAxis, yAxis]);

  // Update zoom level when either it or the data changes
  useEffect(() => {
    if (highchartsChart.current) {
      highchartsChart.current.xAxis?.[0]?.setExtremes(
        subSeconds(Date.now(), 60 + zoomLevel).getTime(),
        addSeconds(Date.now(), 10).getTime()
      );
    }
  }, [highchartsChart, data, zoomLevel]);

  const tooltipFormatter: HighchartsTooltipFormatterFunction = ({ points: groupedPoints }) => {
    const foundRound = pastRounds.find((round) => new Date(round.closedAt!).getTime() === groupedPoints?.[0].x);

    if (!foundRound) {
      return null;
    }

    return <OracleChartTooltip round={foundRound} />;
  };

  return (
    <>
      <Box className="oracle-chart" position="relative" height="100%" width="100%">
        <Box ref={chartElementRef} position="absolute" inset={0} />
        {tooltipFormatter && (
          <HighchartsTooltip chart={highchartsChart.current} tooltipFormatter={tooltipFormatter} withContainer />
        )}
      </Box>
      <OracleChartStyles data={data} currentRoundLockPrice={Number(currentRoundLockPrice)} />
    </>
  );
};
