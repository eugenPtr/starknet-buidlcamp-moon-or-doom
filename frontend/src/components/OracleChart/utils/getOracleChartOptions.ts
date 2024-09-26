import { TFunction } from "next-i18next";
import { subMinutes } from "date-fns/subMinutes";
import Highcharts from "highcharts";
import { formatNumberToLocale } from "@looksrare/utils";

export const getOracleChartOptions = (t: TFunction): Highcharts.Options => {
  return {
    chart: {
      styledMode: true,
      animation: {
        duration: 0,
      },
    },
    xAxis: [
      {
        type: "datetime",
        labels: {
          format: "{value:%k:%M:%S}",
        },
        crosshair: false,
        zoomEnabled: true,
        min: subMinutes(Date.now(), 1).getTime(),
      },
    ],
    yAxis: [
      {
        type: "linear",
        allowDecimals: false,
        opposite: true,
        crosshair: false,
        minPadding: 0,
        title: {
          text: "",
        },
        labels: {
          formatter: function ({ value }) {
            if (typeof value !== "number") {
              return value;
            }

            return formatNumberToLocale(value, 2);
          },
          align: "right",
          reserveSpace: true,
        },
      },
    ],
    series: [
      {
        name: t("Price"),
        type: "line",
        marker: {
          enabled: false,
        },
        enableMouseTracking: false,
      },
      {
        name: t("mod::Past round prices"),
        type: "line",
        marker: {
          radius: 3,
          symbol: "circle",
        },
      },
      {
        name: t("Current price"),
        type: "line",
        enableMouseTracking: false,
        marker: {
          radius: 5,
          symbol: "circle",
        },
      },
    ],
  };
};
