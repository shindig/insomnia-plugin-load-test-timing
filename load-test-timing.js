const css = `
header { padding-bottom: 20px; text-align: center; }
header b { padding-left: 10px; }
table { margin-top: 5px; margin-bottom: 20px; width: 100%; }
th { text-align: left; white-space: nowrap; padding: 10px !important; font-size: 14px !important; border: 1px solid #CCC; }
td { border: 1px solid #CCC; padding: 5px 5px 5px 10px; }
td.shrink {
  white-space: nowrap;
  width: 1px;
}
footer { padding-top: 20px; text-align: center; }`;

const startHtml = `
<html lang="en">
 <head>
  <title>Load Test</title>
  <style>${css}</style>
 </head>
 <body>`;

const titleSummaryTableHTML = `
  <div>SUMMARY</div>
`;

const startSummaryTableHtml = `
  <table>
   <tr>
    <th>Request</th>
    <th># Successes</th>
    <th># Fails</th>
    <th>Avg. Time (ms)</th>
    <th>Total Time (ms)</th>
   </tr>`;

const titleDetailsTableHTML = `
<div>DETAILS</div>
`;

const startDetailsTableHtml = `
<div>DETAILS
  <table>
   <tr>
    <th style="text-align: center">#</th>
    <th style="text-align: center">Request</th>
    <th style="text-align: center">Response</th>
    <th style="text-align: center">Time (ms)</th>
   </tr>
</div>`;

const endTable = `
  </table>`;

const footer = `
  <footer>
    Times are more accurate with more iterations (initial first request is delayed)
  </footer>
 </body>
</html>`;

const action = async (context, requests) => {
  const progressModal = document.createElement('div');
  let abortRequests = false;
  let numIterations, delayBetweenRequests, runInParallel;

  try {
    const numIterationsPrompt = await context.app.prompt(
      "How many iterations? (1/3)",
      {
        label: "# Iterations",
        defaultValue: "10",
        cancelable: true,
        submitName: "Next",
      },
    );

    numIterations = parseInt(numIterationsPrompt);

    const delayBetweenRequestsPrompt = await context.app.prompt(
      "Millisecond delay between requests? (2/3)",
      {
        label: "# Milliseconds (1000 milliseconds = 1 second)",
        defaultValue: "1",
        cancelable: true,
        submitName: "Next",
      },
    );

    delayBetweenRequests = parseInt(delayBetweenRequestsPrompt);

    const bStr = (
      await context.app.prompt("Run all requests in parallel? (3/3)", {
        label: "Run in parallel (Y/N)",
        defaultValue: "N",
        cancelable: true,
      })
    )
      .toLowerCase()
      .trim();

    runInParallel =
      bStr === "y" || bStr === "yes" || bStr === "true" || bStr === "1";
  } catch (err) {
    if (!err.message || !err.message.endsWith("cancelled")) {
      context.app.alert("Unknown Error Occurred", err.message || "?");
      console.log(err);
    }

    return;
  }

  if (!numIterations) {
    return;
  }

  const header = `
      <header>
        <b># Iterations:</b> ${numIterations} <b>Delay between requests:</b> ${delayBetweenRequests}ms <b>Run:</b> 
        ${runInParallel ? "in Parallel" : "Serially"}
      </header>`;

  try {
    const results = requests.map((_) => {
      return {
        successes: 0,
        fails: 0,
        total: 0,
      };
    });

    const detailedResults = []
    let iteration = 0
    const recorder = (responses, j) => {
      responses.forEach((response, i) => {
        const result = results[j || i];
        const detailedResult = {}

        if (runInParallel) {
          if (i % requests.length == 0) {
            iteration++
          }
        } else {
          if (j == 0) {
            iteration++
          }
        }

        detailedResult.iteration = iteration
        detailedResult.statusCode = response.statusCode.toString()
        detailedResult.status = response.statusMessage
        detailedResult.elapsedTime = response.elapsedTime
        detailedResult.url = response.url.toString()
        detailedResult.name = requests[j || i].name.toString()

        detailedResults.push(detailedResult)

        if (response.statusCode.toString().startsWith("2")) {
          result.successes++;
          result.total += response.elapsedTime;
        } else {
          result.fails++;
        }
      });
    };

    const sendRequests = (reqs) => {
      return Promise.all(reqs.map((r) => context.network.sendRequest(r)));
    };

    const execute = () => {
      progressModal.style.padding = '20px';
      progressModal.innerHTML = `
      <h4><font color=red><strong>If you close this, requests will be aborted</strong></font></h4>
      <p>Please wait until all requests finishes. Due to the limitations of the Insomnia Plugins we can not show you a progress bar 
      but you can always open the DevTools and see the console.</p>`;
      context.app.dialog("Processing", progressModal, {
        onHide: () => {
          console.info(`aborted...`);
          abortRequests = true;
        }
      });
      return new Promise((resolve, reject) => {
        const runIt = async (currentIteration) => {
          if (abortRequests) {
            return reject({ message: "Aborted by user" });
          }

          console.log("Run # " + (currentIteration + 1));

          if (delayBetweenRequests > 0 && currentIteration == 0) {
            console.log("Waiting for the first delay...");
            await new Promise((r) => setTimeout(r, delayBetweenRequests));
          }

          if (runInParallel) {
            recorder(await sendRequests(requests));
          } else {
            for (let j = 0; j < requests.length; j++) {
              if (abortRequests) {
                return reject({ message: "Aborted by user" });
              }
              recorder(await sendRequests([requests[j]]), j);
            }
          }

          if (currentIteration < numIterations - 1) {
            setTimeout(async () => {
              runIt(currentIteration + 1);
            }, delayBetweenRequests);
          } else {
            return resolve();
          }
        };

        runIt(0);
      });
    };

    const startTime = performance.now();
    await execute();
    const endTime = performance.now();
    const totalTimeElapsed = endTime - startTime

    const summaryRows = [];

    results.forEach((r, i) => {
      const request = requests[i];
      const result = results[i];
      const avg = result.total / result.successes;

      let color;

      if (result.successes === numIterations) {
        color = "limegreen";
      } else {
        color = "red";
      }

      summaryRows.push(
        `<tr>
          <td>${request.name || request.url}</td>
          <td align="center"><span style="color: ${color}">${result.successes}</span></td>
          <td align="center"><span style="color: ${color}">${result.fails}</span></td>
          <td align="center">${avg.toFixed(1)}</td>
          <td align="center">${result.total.toFixed(1)}</td>
        </tr>`,
      );
    });

    const timeElapsedTable =
      `<table>
        <tr>
          <td >Total load test duration</td>
          <td align="center" style="min-width: 70px" class="shrink"><span >${totalTimeElapsed.toFixed(2)} ms</span></td>
        </tr>
      </table>`
      ;

    const detailedRows = [];
    let tableIteration = 0;

    detailedResults.forEach((result, i) => {

      let color;

      const responseType = result.statusCode.charAt(0)

      switch (responseType) {
        case "2":
          color = "limegreen";
          break;
        case "3":
        case "4":
          color = "orange";
          break;
        case "5":
          color = "red";
          break;
      }

      if (tableIteration < result.iteration) {
        tableIteration = result.iteration;

        if (tableIteration > 1) {
          detailedRows.push(`
          </table>`,
          );
        }
        detailedRows.push(`
          <span style="color: grey">Iteration ${tableIteration.toString()}</span>
        <table>`,
        );
      };

      detailedRows.push(
        `<tr>
          <td align="center" style="min-width: 30px" class="shrink" >${i + 1}</td>
          <td align="center" >${result.name || result.url}</td>
          <td align="center" style="width: 250px" ><span style="color: ${color}">${result.statusCode} ${result.status}</span></td>
          <td align="right" style="min-width: 70px" class="shrink" >${result.elapsedTime.toFixed(1)} ms</td>
        </tr>`,
      );
    });

    const html = startHtml + header + titleSummaryTableHTML + startSummaryTableHtml + summaryRows.join("") + endTable + timeElapsedTable + titleDetailsTableHTML + detailedRows.join("") + endTable + footer;
    progressModal.innerHTML = html;
    context.app.dialog("Results", progressModal, {
      tall: true,
    });

  } catch (err) {
    if (!abortRequests) {
      context.app.alert("Unknown Error Occurred", err.message);
      console.log(err);
    }
  }
};

module.exports.requestActions = [
  {
    label: "Load Test",
    action: async (context, data) => {
      const { request } = data;
      action(context, [request]);
    },
  },
]

module.exports.requestGroupActions = [
  {
    label: "Load Test",
    action: async (context, data) => {
      const { requests } = data;
      action(context, requests);
    },
  },
];

module.exports.workspaceActions = [
  {
    label: "Load Test",
    action: async (context, data) => {
      const { requests } = data;
      action(context, requests);
    },
  },
];
