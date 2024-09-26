import { useEffect, useRef } from "react";
import Highcharts, { Chart as HighchartsChart } from "highcharts";
import { useTranslation } from "next-i18next";
import { defaultHighchartsOptions } from "@looksrare/uikit";
import { getOracleChartOptions } from "../utils/getOracleChartOptions";

export const useOracleChart = () => {
  const { t } = useTranslation();
  const chartElementRef = useRef<HTMLDivElement>(null);
  const highchartsChart = useRef<HighchartsChart | null>(null);

  useEffect(() => {
    const chartOptions = getOracleChartOptions(t);
    if (chartElementRef.current) {
      Highcharts.setOptions({
        lang: {
          thousandsSep: ",",
        },
      });

      Highcharts.chart(
        chartElementRef.current,
        Highcharts.merge(defaultHighchartsOptions, chartOptions),
        (chart: HighchartsChart) => {
          highchartsChart.current = chart;
        }
      );
    }
  }, [chartElementRef, t]);

  return { chartElementRef, highchartsChart };
};
