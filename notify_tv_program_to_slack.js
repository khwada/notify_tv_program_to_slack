const webhook_url = 'https://hooks.slack.com/hogehoge';

const keywords = [
    'NHKスペシャル',
    '金曜ロードショー',
]

const exclude_keywords = [
    'Ｎスペ５ｍｉｎ',
    'バビブベボディ',
    'まもなく金曜ロードショー',
]

async function notify_tv_program() {
    let items = await search(keywords);
    items = await filter(items, exclude_keywords);
    items = await sort(items);
    items = await unique(items);
    // console.log(JSON.stringify(items, null, 2));
    const json = await convert(items);
    // console.log(JSON.stringify(json, null, 2));
    await notifyPromise(webhook_url, json);
}

async function search(keywords) {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    let items = []
    try {
        for (let keyword of keywords) {
            items = items.concat(await search_keyword(page, keyword));
        }
        return items;
    } finally {
        await browser.close();
    }
}

async function search_keyword(page, keyword) {
    const url = `https://tv.yahoo.co.jp/search?t=3&q=${keyword}`;
    console.log(`request: ${url}`)
    await page.goto(url);
    await page.waitForSelector('span.searchResultHeaderSumResultNumber');
    return await page.evaluate(() => {
        const number = document.querySelector('span.searchResultHeaderSumResultNumber').textContent;
        if (number === '0') {
            return [];
        }
        const nodeList = Array.from(document.querySelectorAll('li.programListItem'));
        return nodeList.map(element => {
            return {
                title: element.querySelector('.programListItemTitleLink').textContent,
                url: element.querySelector('.programListItemTitleLink').href,
                schedule: element.querySelector('.scheduleText').textContent,
                scheduleDateTime: element.querySelector('.scheduleText').dateTime,
                scheduleEnd: element.querySelector('.scheduleTextTimeEnd').textContent,
                channel: element.querySelector('.channelText').firstChild.textContent,
                description: element.querySelector('.programListItemDescription').textContent,
            }
        });
    });
}

async function filter(items, exclude_keywords) {
    return items.filter(item => !exclude_keywords.find(exclude => item.title.includes(exclude)));
}

async function sort(items) {
    return items.sort((a, b) => Date.parse(a.scheduleDateTime) - Date.parse(b.scheduleDateTime));
}

async function unique(items) {
    const uniqueItems = [];
    items.forEach(item => {
        const uniqueItem = uniqueItems.find(u => u.title === item.title);
        if (uniqueItem) {
            uniqueItem.at.push(`${item.schedule}-${item.scheduleEnd}@${item.channel}`);
        } else {
            uniqueItems.push({
                title: item.title,
                url: item.url,
                at: [`${item.schedule}-${item.scheduleEnd}@${item.channel}`],
                description: item.description,
            });
        }
    });
    return uniqueItems;
}

async function convert(items) {
    const blocks = [];
    items.forEach(item => {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `<${item.url}|${item.title}>\n${item.at.join(', ')}\n${item.description}`,
            }    
        });
        blocks.push({
            type: 'divider',
        });
    });
    return {
        blocks
    }
}


function notifyPromise(webhook_url, json) {
    return new Promise((resolve, reject) => {
        const request = require('request');
        const options = {
            uri: webhook_url,
            headers: {
                "Content-type": "application/json",
            },
            json,    
        };
        request.post(options, function(error, response, body){
            if (error || response.statusCode !== 200) {
                reject(`error: ${response.statusCode}, ${response.body}`);
            } else {
                resolve();
            }
        });
    });
}

notify_tv_program();
