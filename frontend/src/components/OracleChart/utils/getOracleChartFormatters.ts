import { PointOptionsType } from "highcharts";
import { formatNumberToLocale } from "@looksrare/utils";
import { MoDRoundFragment } from "@looksrare/yolo-games-gql-typegen";

export const formatPastRoundsData = (pastRounds: MoDRoundFragment[]): PointOptionsType[] => {
  return (
    pastRounds
      .filter((round) => !!round.closedAt && !!round.closePrice)
      .map((round) => ({
        x: new Date(round.closedAt!).getTime(),
        y: Number(round.closePrice!),
        className: round.result?.result,
      })) ?? []
  );
};

export const formatLatestDataPointData = (latestDataPoint: [number, number]): PointOptionsType[] => {
  return [
    {
      x: latestDataPoint[0],
      y: latestDataPoint[1],
      dataLabels: {
        align: "right",
        enabled: true,
        useHTML: true,
        formatter: function () {
          return formatNumberToLocale(latestDataPoint[1], 2);
        },
      },
    },
  ];
};
