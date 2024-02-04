const express = require('express');
const router = express.Router();
const axios = require("axios");

const { countryMap, serviceMap } = require('../data/data_maps');

router.get('/getCountryList', (req, res) => {
    res.json(Object.fromEntries(countryMap));
});

router.get('/getServiceList', (req, res) => {
    res.json(Object.fromEntries(serviceMap));
});

router.get('/service/get-all', async (req, res) => {
    try {
        const data = await axios.get('https://grizzlysms.com/api/service/get-all');
        // const response = await data.json();
        console.log(data.data, 'data')

        res.status(200).send(data.data);
    } catch (err) {
        console.log(err);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/country/get-prices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { page, wholesale, user } = req.query;
        const data = await axios.get(`https://grizzlysms.com/api/country/get-prices/${id}?page=${page}&wholesale=${wholesale}&user=${user}`);
        // const response = await data.json();

        res.status(200).send(data.data);
    } catch (err) {
        console.log(err);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/getPriceByCountryService', async (req, res) => {
    try {
        const { country, service } = req.body;
        console.log(req.body, 'body')

        const data = await axios.get(`https://api.grizzlysms.com/stubs/handler_api.php?api_key=${process.env.API_KEY}&action=getPrices&service=${service}&country=${country}`)
        console.log(data, 'data')
        // const response = await data.json();

        let parsedData = data.data[country][service];

        let cost = parsedData.cost + (parsedData.cost * 0.1);
        let quantity = parsedData.count;

        res.status(200).send({ cost, quantity });
    }
    catch (err) {
        console.log(err);
        res.status(500).send("Internal Server Error");
    }
})

router.post('/getCountryServiceList', async (req, res) => {

    try {
        const { country } = req.body;

        const data = await axios.get(`https://api.grizzlysms.com/stubs/handler_api.php?api_key=${process.env.API_KEY}&action=getPrices&country=${country}`)
        // const response = await data.json();

        let parsedData = data.data[country];

        // extract all services from the parsedData
        let services = Object.keys(parsedData);

        let priceList = [];

        services.forEach(service => {
            let cost = parsedData[service].cost + (parsedData[service].cost * 0.1);
            let quantity = parsedData[service].count;
            let serviceName = serviceMap.get(service);

            priceList.push({ serviceCode: service, serviceName, cost, quantity })
        });

        priceList = priceList.filter(service => service.serviceName !== undefined);

        res.status(200).send(priceList);
    }
    catch (err) {
        console.log(err);
        res.status(500).send("Internal Server Error");
    }

})

router.post('/getServicePriceList', async (req, res) => {

    try {
        const { service } = req.body;

        const data = await axios.get(`https://api.grizzlysms.com/stubs/handler_api.php?api_key=${process.env.API_KEY}&action=getPrices&service=${service}`)
        // const response = await data.json();
        console.log(data, 'dat')

        let countryCodes = Object.keys(data.data);

        console.log(countryCodes);

        let priceList = [];

        countryCodes.forEach(country => {
            let cost = data.data[country][service].cost + (data.data[country][service].cost * 0.1);
            let quantity = data.data[country][service].count;
            let countryName = countryMap.get(parseInt(country));

            priceList.push({ countryCode: country, countryName, cost, quantity })
        });

        priceList = priceList.filter(country => country.countryName !== undefined);

        res.status(200).send(priceList);
    }
    catch (err) {
        console.log(err);
        res.status(500).send("Internal Server Error");
    }

})

module.exports = router;


