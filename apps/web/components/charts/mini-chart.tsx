'use client';

import { useEffect, useRef } from 'react';
import {
  ColorType,
  createChart,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';

export interface ChartBar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

interface MiniChartProps {
  bars: ChartBar[];
  height?: number;
  /** Horizontal price line, e.g. priceAtSignal. */
  marker?: { price: number; label?: string; color?: string };
  /** Default line color for the close-price series. */
  color?: string;
}

export function MiniChart({
  bars,
  height = 140,
  marker,
  color = '#a089ff',
}: MiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const markerRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9099ad',
        fontSize: 11,
      },
      grid: {
        horzLines: { color: 'rgba(38, 43, 58, 0.6)' },
        vertLines: { visible: false },
      },
      timeScale: {
        borderColor: 'rgba(38, 43, 58, 0.6)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(38, 43, 58, 0.6)',
        scaleMargins: { top: 0.15, bottom: 0.1 },
      },
      handleScroll: false,
      handleScale: false,
      crosshair: { mode: 1 },
    });
    const area = chart.addAreaSeries({
      lineColor: color,
      topColor: 'rgba(160, 137, 255, 0.32)',
      bottomColor: 'rgba(160, 137, 255, 0.02)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    seriesRef.current = area;
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markerRef.current = null;
    };
  }, [height, color]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    const data = bars.map((b) => ({
      time: b.time as UTCTimestamp,
      value: b.close,
    }));
    series.setData(data);
    chart.timeScale().fitContent();
  }, [bars]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (!marker) return;
    const line = series.createPriceLine({
      price: marker.price,
      color: marker.color ?? '#9099ad',
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      axisLabelVisible: true,
      title: marker.label ?? 'mark',
    });
    return () => {
      try {
        series.removePriceLine(line);
      } catch {
        /* chart already torn down */
      }
    };
  }, [marker?.price, marker?.label, marker?.color]);

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}
