const {areaLeavesOnOff:check} = require('../leaves-on-off');

const isVerbose = process.argv[2] === 'verbose'

function test(fnArr, expected, label) {
    if (!test.isInit) {
        test.hasErrors = false;
        test.passedTestsCount = 0;
        test.isInit
    }


    const actual = fnArr[0].apply(undefined, fnArr.slice(1))
    const labelWithActualParams = `${label} :: ${fnArr.slice(1).map(v => `|${v}|`).join('+')} => ${actual}`;

    if (expected === actual) {
        test.passedTestsCount++;
        if (isVerbose) {
            console.log(`ok: ${labelWithActualParams}`)
        }
    } else {
        test.hasErrors = true;
        console.log(`ERROR: |${expected}| :: ${labelWithActualParams}`)
    }
}
test([check, '', ''], false, 'empty inputs');
test([check, '2020111', '2021201'], false,  'invalid dates (short)');

test([check, '20201111', '20201201'], 'off',  'same year: winter 1');
test([check, '20201111', '20201231'], 'off',  'same year: winter 1');
test([check, '20201102', '20201212'], 'off',  'same year: winter 1, close to fall/winter transition');
test([check, '20201102', '20201212'], 'off',  'same year: winter 1, on cusp of fall/winter transition');
test([check, '20201030', '20201212'], 'mixed',  'same year: winter 1, over the cusp of fall/winter transition');

test([check, '20200101', '20200303'], 'off',  'same year: winter 2');
test([check, '20200229', '20200301'], 'off',  'same year: winter 2');
test([check, '20200101', '20200330'], 'off',  'same year: winter 2, close to fall/winter transition');
test([check, '20200101', '20200331'], 'off',  'same year: winter 2, on cusp of fall/winter transition');
test([check, '20200101', '20200401'], 'mixed',  'same year: winter 2, over the cusp of winter/spring transition');

test([check, '20201115', '20210215'], 'off',  'two year: winter');
test([check, '20201231', '20210101'], 'off',  'two year: winter');
test([check, '20201102', '20210330'], 'off',  'two year: winter, close to transition');
test([check, '20201101', '20210331'], 'off',  'two year: winter, on cusp of transition');
test([check, '20201030', '20210331'], 'mixed',  'two year: winter, over cusp of transition');
test([check, '20201101', '20210401'], 'mixed',  'two year: winter, over cusp of transition');
test([check, '20201030', '20210401'], 'mixed',  'two year: winter, over cusp of transition');

test([check, '20200504', '20200815'], 'on',  'same year: summer');
test([check, '20200504', '20200929'], 'on',  'same year: summer, close to summer/fall transition');
test([check, '20200504', '20200930'], 'on',  'same year: summer, on cusp of summer/fall transition');
test([check, '20200504', '20201001'], 'mixed',  'same year: summer, over cusp of summer/fall transition');
test([check, '20200502', '20200901'], 'on',  'same year: summer, close to spring/summer transition');
test([check, '20200501', '20200901'], 'on',  'same year: summer, on cusp of spring/summer transition');
test([check, '20200430', '20200901'], 'mixed',  'same year: summer, over cusp of spring/summer transition');
test([check, '20200501', '20200930'], 'on',  'same year: full exact summer');

test([check, '20200415', '20201015'], 'mixed',  'same year: very mixed');



if (!isVerbose && !test.hasErrors) {
    console.log(`ok: all ${test.passedTestsCount} tests passed`)
}