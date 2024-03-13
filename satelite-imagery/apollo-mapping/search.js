const data1 = {
    "cloudcover_max": "9",
    "offnadir_max": "28",
    "resolution_min": "0",
    "resolution_max": "23",
    "dem": "false",
    "coords": [[-87.86865234375,42.04929263868686],[-87.637939453125,42.04929263868686],[-87.637939453125,41.80407814427237],[-87.86865234375,41.80407814427237]],
    "seasonal": "false",
    "monthly": "false",
    "dateRange": "true",
    "dateFilter": [{"startDate":"2017-04-16T00:30:00.000Z","endDate":"2017-05-15T07:00:00.000Z"}],
    "stereo": "false",
    "lazyLoad": "false",
    "startDate": "2017-04-15T05:30:00",
    "endDate": "2017-05-15T12:00:00",
    "satellites": ["BJ3A","HEX","HEXD","GE1","K3A","PNEO","P1","SKYC","SV1","SV2","SVN","WV2","WV3","WV4"]
}

fetch("https://imagehunter-api.apollomapping.com/ajax/search", {
    "headers": {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9,de;q=0.8",
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "pragma": "no-cache",
        "sec-ch-ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "Referer": "https://imagehunter.apollomapping.com/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    },

    "body": data,
    "method": "POST"
});
