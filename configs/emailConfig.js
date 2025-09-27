const { SendMailClient } = require("zeptomail");

const url = "api.zeptomail.com/";
const token = process.env.ZOHO_API_KEY;

let client = new SendMailClient({url, token});  

const sendCustomEmail = async(to, name, subject, HTML_content) => {
    return client.sendMail({
        "from": 
        {
            "address": "Noreply@www.godwinconsult.com",
            "name": "AURA"
        },
        "to": 
        [
            {
            "email_address": 
                {
                    "address": `${to}`,
                    "name": `${name}`
                }
            }
        ],
        "subject": `${subject}`,
        "htmlbody": `${HTML_content}`,
    }).then((resp) => console.log("success")).catch((error) => console.log("error"));
}

module.exports = sendCustomEmail