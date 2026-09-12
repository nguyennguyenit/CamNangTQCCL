import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:375,height:812}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]+'/#khaihoang');
 await page.locator('.cham-su-card').first().waitFor();
 const count=await page.locator('.cham-su-card').count();if(count!==8)throw Error('groups '+count);
 if(await page.locator('.kh-card').count()!==15)throw Error('opening count');
 if(await page.locator('.kh-transforms').count())throw Error('old label');
 const headings=await page.locator('.kh-section-title').allTextContents();
 if(headings.join('|')!=='Đội hình khai hoang đề xuất|Team Chạm Sứ / Ăn vạ|Quân thủ các mỏ')throw Error('order');
 for(const section of ['team-pk','meta-cu','coexist','khaihoang','heroes','tactics','recruit-tracker','analyze','roster-recommend']){
  await page.evaluate(s=>{location.hash=s},section);
  await page.locator('#section-'+section).waitFor({state:'visible'});
 }
 await page.evaluate(()=>{location.hash='khaihoang'});
 await page.reload();await page.locator('.cham-su-card').first().waitFor();
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('overflow');
 if(errors.length)throw Error(errors.join(';'));
 await page.locator('.cham-su-cards').screenshot({path:process.argv[3]+'.png'});
 await writeFile(process.argv[3]+'.json',JSON.stringify({url:process.argv[2],groups:count,openingTeams:15,sections:9,reload:true,mobileOverflow:false,pageErrors:errors},null,2));
 console.log('Browser verified 8 groups,15 teams,9 sections,reload,mobile');
} finally {await browser.close();}
