import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resources, levels, lessonsFor, workbookFor, videoFor, sampleFor, sampleForLesson } from "../src/resources/catalog.js";
import { resourceStructuredData } from "../src/resources/page.js";
import { Page, routesFor } from "../src/pages.js";
import React, { renderToStaticMarkup } from "../src/react.js";
import { configSchema } from "../src/config.js";
import { googlePage, googlePageTitle, googleEvent } from "../../amp/src/analytics/google-analytics.js";
import { marketingScreen } from "../../amp/src/analytics/site-categories.js";
import { siteActionSchema } from "../../amp/src/analytics/site-actions.js";

test("every grade/course connects valid curriculum, two lessons, paper and video",()=>{
  assert.equal(levels.length,13);
  for(const level of levels) {
    assert.ok(sampleFor(level).explanation.length);
    const lessons=lessonsFor(level);
    assert.equal(new Set(lessons.map(l=>l.id)).size,2);
    for(const lesson of lessons) assert.ok(sampleForLesson(lesson,level).answer);
    const workbook=workbookFor(level);
    assert.equal(workbook.files.length,2);
    assert.ok(workbook.minutes>=42.5 && workbook.minutes<=45);
    for(const file of workbook.files) {
      const bytes=readFileSync(`public${file.url}`);
      assert.equal(bytes.subarray(0,5).toString(),"%PDF-");
      assert.equal(createHash("sha256").update(bytes).digest("hex"),file.sha256);
      assert.ok(file.answerKeyPages>0 && file.studentPages>0);
    }
    const video=videoFor(level);
    for(const key of ["videoUrl","captionsUrl","posterUrl"] as const) assert.equal(new URL(video[key]).protocol,"https:");
    assert.ok(video.transcript.length>100 && video.durationSeconds>0);
    assert.ok(Number.isFinite(Date.parse(video.uploadDate)));
  }
});

test("resource pages have complete static content, valid anchors and distinct canonical identities",()=>{
  const config=configSchema.parse({siteUrl:"https://example.invalid"});
  const routes=new Set(routesFor(config));
  const titles=new Set<string>();
  for(const page of resources) {
    const html=renderToStaticMarkup(React.createElement(Page,{route:page.path,config}));
    assert.equal((html.match(/<h1[ >]/g)??[]).length,1,page.path);
    assert.ok(!/>undefined</.test(html),page.path);
    const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(ids.length,new Set(ids).size,page.path);
    for(const [,href] of html.matchAll(/<a[^>]*href="(\/[^"#]*)(?:#[^"]*)?"/g)) if(!href!.endsWith(".pdf")) assert.ok(routes.has(href!),`${page.path} links to ${href}`);
    for(const [,id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id),`${page.path} missing ${id}`);
    const canonical=new URL(page.path,config.siteUrl).href;
    assert.ok(html.includes(`rel="canonical" href="${canonical}"`));
    const title=html.match(/<title>(.*?)<\/title>/)![1]!;
    assert.ok(!titles.has(title),`Duplicate title ${title}`); titles.add(title);
    const graph=resourceStructuredData(page,config)!["@graph"];
    assert.ok("url" in graph[0]!);
    assert.equal(graph[0].url,canonical);
    if(page.kind==="video") {
      assert.equal(graph[0]!["@type"],"VideoObject");
      assert.ok(html.includes('<video') && html.includes(page.video.transcript.split(".")[0]!));
    }
  }
});

test("resource measurement accepts only fixed categories and actions",()=>{
  for(const [path,screen] of [["/grades/3/","marketing_grades"],["/workbooks/grade-3/","marketing_workbooks"],["/videos/count-objects/","marketing_lessons"],["/compare/amp-vs-ixl/","marketing_compare"]]) assert.equal(marketingScreen(path!),screen);
  for(const action of ["workbook_download","video_play","video_complete"]) assert.ok(siteActionSchema.safeParse({eventId:"50a4962e-1c03-477f-a454-b2edc924c6ae",action,screen:"marketing_lessons"}).success);
  assert.ok(!siteActionSchema.safeParse({eventId:"50a4962e-1c03-477f-a454-b2edc924c6ae",action:"video_play",screen:"marketing_lessons",learner:"private"}).success);
});

test("GA resource pages use the compiled public catalog and strip private query fields",()=>{
  const pages=Object.fromEntries(resources.map(p=>[p.path.replace(/\/$/,""),p.label]));
  assert.equal(googlePage("https://corpora.inc/videos/count-objects/?email=private&learner=secret","pitch",pages),"https://corpora.inc/videos/count-objects");
  assert.equal(googlePageTitle("https://corpora.inc/videos/count-objects/","pitch",pages),"Kindergarten video lesson");
  assert.equal(googlePage("https://corpora.inc/private/account","pitch",pages),undefined);
  assert.equal(googlePage("https://amp.corpora.inc/videos/count-objects/","pitch",pages),undefined);
  assert.equal(googleEvent("workbook_download",{learner:"private"},"https://corpora.inc/workbooks/")?.name,"file_download");
});
