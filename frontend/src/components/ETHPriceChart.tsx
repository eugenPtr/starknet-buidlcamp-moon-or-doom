import React, { useEffect, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

// Ensure we have the modules for real-time updates and animations
import HC_more from 'highcharts/highcharts-more';
import HC_exporting from 'highcharts/modules/exporting';

HC_more(Highcharts);
HC_exporting(Highcharts);

const ETHPriceChart = () => {
  const [chartOptions, setChartOptions] = useState({
    chart: {
      type: 'line',
      animation: Highcharts.svg,
      height: '400px'  // Explicitly set height
    },
    title: {
      text: 'ETH Price Chart'
    },
    xAxis: {
      type: 'datetime',
      tickPixelInterval: 150
    },
    yAxis: {
      title: {
        text: 'Price (USD)'
      },
      plotLines: [{
        value: 0,
        width: 1,
        color: '#808080'
      }]
    },
    tooltip: {
      formatter: function () {
        return '<b>' + this.series.name + '</b><br/>' +
          Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '<br/>' +
          Highcharts.numberFormat(this.y, 2);
      }
    },
    legend: {
      enabled: false
    },
    exporting: {
      enabled: true
    },
    series: [{
      name: 'ETH Price',
      data: []  // Start with empty data
    }]
  });

  const chartComponentRef = useRef(null);

  useEffect(() => {
    // Generate initial data
    const initialData = [];
    const time = new Date().getTime();
    for (let i = -19; i <= 0; i += 1) {
      initialData.push([
        time + i * 1000,
        Math.random() * 100 + 3000
      ]);
    }

    // Update chart options with initial data
    setChartOptions(prevOptions => ({
      ...prevOptions,
      series: [{
        ...prevOptions.series[0],
        data: initialData
      }]
    }));

    // Set up interval for real-time updates
    const intervalId = setInterval(() => {
      const x = new Date().getTime();
      const y = Math.random() * 100 + 3000;
      
      setChartOptions(prevOptions => {
        const newData = [...prevOptions.series[0].data, [x, y]];
        if (newData.length > 20) newData.shift(); // Keep only last 20 points

        return {
          ...prevOptions,
          series: [{
            ...prevOptions.series[0],
            data: newData
          }]
        };
      });
    }, 1000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <HighchartsReact
        highcharts={Highcharts}
        options={chartOptions}
        ref={chartComponentRef}
      />
    </div>
  );
};

export default ETHPriceChart;