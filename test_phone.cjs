const libphonenumber = require("google-libphonenumber");

const validatePhoneNumber = (code, number) => {
    if (!number) return null;
    try {
        const PNF = libphonenumber.PhoneNumberFormat;
        const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();

        let phoneNumber;
        if (number.startsWith("+")) {
            phoneNumber = phoneUtil.parseAndKeepRawInput(number);
        } else {
            phoneNumber = phoneUtil.parseAndKeepRawInput(number, code || "TN");
        }

        const nationalNumber = phoneNumber.getNationalNumber().toString();
        const digitCount = nationalNumber.length;

        console.log(`Parsed: ${phoneNumber.getNationalNumber()}, Digits: ${digitCount}, Country: ${phoneUtil.getRegionCodeForNumber(phoneNumber)}`);

        if (digitCount < 5 || digitCount > 15) {
            console.warn(`[Phone-Validation] Invalid digit count: ${digitCount}`);
            return null;
        }

        return phoneUtil.format(phoneNumber, PNF.E164);
    } catch (error) {
        console.error("Phone Validation Error:", error.message);
        return null;
    }
};

const test = () => {
    const cases = [
        { code: "TR", number: "+90 510 987 65 23" },
        { code: "TR", number: "5109876523" },
        { code: "TN", number: "20123456" },
    ];

    cases.forEach(c => {
        const res = validatePhoneNumber(c.code, c.number);
        console.log(`Case: ${c.code} ${c.number} -> Result: ${res}`);
    });
};

test();
