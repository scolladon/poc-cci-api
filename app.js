const axios = require('axios');
require("dotenv").config();
/****************************************************/
/* Constants
/****************************************************/
const CIRCLECI_TOKEN = process.env.CIRCLECI_TOKEN
const SUCCESS_STATUS = 'success'
const TERMINATED_STATUS = [SUCCESS_STATUS, 'failed', 'error', 'canceled', 'unauthorized']

/****************************************************/
/* Utils
/****************************************************/
const poll = fn => async check => {
    let condition = false;
    let result;
    while (!condition) {
        result = await fn()
        condition = check(result);
        if(!condition) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    return result
}

/****************************************************/
/* Request Configurations
/****************************************************/
const pipeline = {
    // https://circleci.com/docs/api/v2/#operation/triggerPipeline
    method: 'post',
    url: 'https://circleci.com/api/v2/project/github/scolladon/poc-cci-api/pipeline',
    headers: {
        'Circle-Token': CIRCLECI_TOKEN,
    },
    data: {
        branch: 'main',
        parameters: {run_workflow_artifact: true}
    }
};

const getWorkflowsRequest = body => ({
    // https://circleci.com/docs/api/v2/#operation/listWorkflowsByPipelineId
    method: 'GET',
    url: `https://circleci.com/api/v2/pipeline/${body.data.id}/workflow`,
    headers: {'Circle-Token': CIRCLECI_TOKEN,}
});

const getWorkflowRequest = body => ({
    // https://circleci.com/docs/api/v2/#operation/getWorkflowById
    method: 'GET',
    url: `https://circleci.com/api/v2/workflow/${body.id}`,
    headers: {'Circle-Token': CIRCLECI_TOKEN,}
})
  
const getJobsRequest = body => ({
    // https://circleci.com/docs/api/v2/#operation/listWorkflowJobs
    method: 'GET',
    url: `https://circleci.com/api/v2/workflow/${body.data.id}/job`,
    headers: {'Circle-Token': CIRCLECI_TOKEN,}
});

const getArtifactsRequest = body => ({
    // https://circleci.com/docs/api/v2/#operation/getJobArtifacts
    method: 'GET',
    url: `https://circleci.com/api/v2/project/github/scolladon/poc-cci-api/${body.job_number}/artifacts`,
    headers: {'Circle-Token': CIRCLECI_TOKEN,}
});

const getArtifactRequest = body => ({
    // https://circleci.com/docs/api/v2/#operation/getJobArtifacts
    method: 'GET',
    url: body.url,
    responseType: 'blob',
    headers: {'Circle-Token': CIRCLECI_TOKEN,}
});


/****************************************************/
/* Main Loop
/****************************************************/
const main = async () =>  {
    // Launch pipeline
    const spawnedPipeline = await axios.request(pipeline);  
    //console.log(spawnedPipeline)

    // Get workflow by pipeline id
    const workflows = getWorkflowsRequest(spawnedPipeline);
    const workflowsList = await axios.request(workflows);
    const workflowItem = workflowsList.data.items[0];

    // Poll workflow by Id and check status "success" or "failed" or "error" or "canceled" or "unauthorized"
    const requestWorkflow = async () => await axios.request(getWorkflowRequest(workflowItem));
    const requestPoller = poll(requestWorkflow);

    const workflowResult = await requestPoller((result) => TERMINATED_STATUS.includes(result.data.status))
    if(workflowResult.data.status !== SUCCESS_STATUS) {
        throw new Error(workflowResult.data);
    }

    // Get workflow jobs
    const jobs = getJobsRequest(workflowResult);
    const jobsList = await axios.request(jobs);
    const jobItem = jobsList.data.items[0];

    // Get job artifact
    const artifacts = getArtifactsRequest(jobItem);
    const artifactsList = await axios.request(artifacts);
    const artifactItem = artifactsList.data.items[0];

    // Download artifact
    const artifact = await axios(getArtifactRequest(artifactItem));
    console.log(artifact.data)
}

// Execute main loop
main();
