const fs = require('fs');
const request = require('request');
const puppeteer = require('puppeteer');
const uuidv4= require('uuid/v4');

(async function main() {
    const args = process.argv.slice(2);
    let searchTerms;
    //Looking for search terms as program arguments otherwise looking for a json array of search terms
    if(args.length > 0) {
        searchTerms = args;
    } else if (fs.existsSync('search.json')) {
        let contents;
        try {
            contents = fs.readFileSync('search.json');
        } catch (e) {
            console.log(e);
        }
        searchTerms = JSON.parse(contents);
    } else {
        console.log('No search terms specified');
        process.exit(1);
    }
    //For each search term create a unique name directory, open the browser and start searching for images
    for (let i = 0; i < searchTerms.length; i++) {
        const searchTerm = searchTerms[i];
        console.log(`- Looking for '${searchTerm}'.`);

        const dirname = `images-${searchTerm}-${uuidv4()}`;
        if (!fs.existsSync(dirname)) {
            fs.mkdirSync(dirname);
        }

        const url = `https://images.search.yahoo.com/search/images?p=${searchTerm}`;

        try {
            console.log('Open browser..');
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            page.setUserAgent(
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/67.0.3372.0 Safari/537.36'
            );

            console.log(`Go to ${url}`);
            await page.goto(url);
            await page.setViewport({
                width: 1800,
                height: 800,
            });
            //Skip consent form
            await page.waitForSelector('.consent-form');
            const form = await page.$('.consent-form');
            const button = await form.$('button.primary');
            button.click();
            //Target the images
            await page.waitForSelector('#sres');
            await autoScroll(page);
            const images = await page.$$('#sres > li > a > img');
            //Save images with unique names
            for (let i = 0; i < images.length; i++) {
                const url = await page.evaluate(image => image.src, images[i]);
                request(url).pipe(
                    fs.createWriteStream(`${dirname}/${searchTerm}-${uuidv4()}.png`)
                );
                console.log(`Image downloaded ${i + 1}`);
            }

            console.log("Close browser...")
            browser.close();
        } catch (e) {
            console.log('our erroe', e);
        }
    }
})();
//Scroll the page to load additional images
const autoScroll = async page => {
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            let totalHeight = 0;
            let distance = 100;
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
};