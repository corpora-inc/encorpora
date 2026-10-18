/** Export authored content to an independent Python reviewer; no certification here. */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { descriptiveStatisticsLessons as lessons } from '../src/content/descriptive-statistics-lessons';
import { descriptiveStatisticsWorksheet } from '../src/content/descriptive-statistics-worksheets';
import { DescriptiveStatisticsIllustration } from '../src/content/DescriptiveStatisticsIllustration';
const worksheets = lessons.flatMap(lesson => Array.from({length:16},(_,i)=>({
  templateId:lesson.templateIds[0],edition:String(i+1),
  problems:descriptiveStatisticsWorksheet(lesson.templateIds[0]!,lesson.id,String(i+1)),
})));
const figures = (['median','range','iqr'] as const).map(kind=>({kind,html:renderToStaticMarkup(React.createElement(DescriptiveStatisticsIllustration,{kind}))}));
console.log(JSON.stringify({lessons,worksheets,figures}));
