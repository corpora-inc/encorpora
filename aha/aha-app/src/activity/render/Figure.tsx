import React from 'react';
import type { DrawFigure } from '../draw';
import { RichText } from './RichText';
import { BarChartFigure, DataTableFigure, LineChartFigure, PieChartFigure, ScatterPlotFigure } from './figures/charts';
import { CoordinatePlaneFigure } from './figures/plane';
import { GeometryFigure } from './figures/geometry';
import { ArrayGridFigure, ClockFigure, FractionModelFigure, MoneyFigure, NumberLineFigure, PictureFigure, PlaceValueFigure, RulerFigure } from './figures/manipulatives';
import type { FigureInteraction } from './figures/common';

/** Renders one validated figure. Unknown types cannot reach here (the validator rejects them). */
export function FigureView({ figure, interaction }: { figure: DrawFigure; interaction?: FigureInteraction }) {
  const tap = interaction?.kind === 'tap' ? interaction : undefined;
  const plot = interaction?.kind === 'plot' ? interaction : undefined;
  const shade = interaction?.kind === 'shade' ? interaction : undefined;
  const place = interaction?.kind === 'place' ? interaction : undefined;
  let body: React.ReactNode;
  switch (figure.type) {
    case 'bar_chart': body = <BarChartFigure figure={figure} tap={tap} />; break;
    case 'line_chart': body = <LineChartFigure figure={figure} />; break;
    case 'scatter_plot': body = <ScatterPlotFigure figure={figure} />; break;
    case 'pie_chart': body = <PieChartFigure figure={figure} tap={tap} />; break;
    case 'data_table': body = <DataTableFigure figure={figure} />; break;
    case 'coordinate_plane': body = <CoordinatePlaneFigure figure={figure} tap={tap} plot={plot} />; break;
    case 'geometry': body = <GeometryFigure figure={figure} tap={tap} />; break;
    case 'number_line': body = <NumberLineFigure figure={figure} place={place} />; break;
    case 'fraction_model': body = <FractionModelFigure figure={figure} shade={shade} />; break;
    case 'array_grid': body = <ArrayGridFigure figure={figure} />; break;
    case 'place_value_blocks': body = <PlaceValueFigure figure={figure} />; break;
    case 'clock': body = <ClockFigure figure={figure} />; break;
    case 'money': body = <MoneyFigure figure={figure} />; break;
    case 'ruler': body = <RulerFigure figure={figure} />; break;
    case 'picture': body = <PictureFigure figure={figure} tap={tap} />; break;
  }
  const title = 'title' in figure ? figure.title : undefined;
  return (
    <figure className={`ax-figure ax-figure-${figure.type.replace(/_/g, '-')}`} data-figure-id={figure.id}>
      {title && <div className="ax-figure-title">{title}</div>}
      <div className="ax-figure-body">{body}</div>
      {figure.caption && <figcaption><RichText text={figure.caption} /></figcaption>}
    </figure>
  );
}
