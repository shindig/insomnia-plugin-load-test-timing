const css = `
header { padding-bottom: 20px; text-align: center; }
header b { padding-left: 10px; }
table { margin: 0 auto 0 auto; }
th { text-align: left; padding: 10px !important; font-size: 14px !important; border: 1px solid #CCC; }
td { border: 1px solid #CCC; padding: 5px 5px 5px 10px; }
footer { padding-top: 20px; text-align: center; }`;

const startHtml = `
<html lang="en">
 <head>
  <style>${css}</style>
 </head>
 <body>`;

const startTableHtml = `
  <table>
   <tr>
    <th>Request</th>
    <th># Successes</th>
    <th>Avg. Time (ms)</th>
    <th>Total Time (ms)</th>
   </tr>
`;

const endHtml = `
  </table>
  <footer>
    Times are more accurate with more iterations (initial first request is delayed)
  </footer>
 </body>
</html>`;

const action = async (context, data) => {
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
      "Second delay between requests? (2/3)",
      {
        label: "# Seconds",
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
        <b># Iterations:</b> [${numIterations}] <b>Delay between requests:</b> [${delayBetweenRequests}s] <b>Run:</b> 
        [${runInParallel ? "in Parallel" : "Serially"}]
      </header>`;

  try {
    const { requests } = data;
    const results = requests.map((_) => {
      return {
        successes: 0,
        total: 0,
      };
    });

    const recorder = (responses, j) => {
      responses.forEach((response, i) => {
        if (response.statusCode.toString().startsWith("2")) {
          const result = results[j || i];
          result.successes++;
          result.total += response.elapsedTime;
        }
      });
    };

    const sendRequests = (reqs) => {
      return Promise.all(reqs.map((r) => context.network.sendRequest(r)));
    };

    const execute = () => {
      return new Promise((resolve) => {
        const runIt = async (currentIteration) => {
          console.log("Run # " + (currentIteration + 1));

          if (runInParallel) {
            recorder(await sendRequests(requests));
          } else {
            for (let j = 0; j < requests.length; j++) {
              recorder(await sendRequests([requests[j]]), j);
            }
          }

          if (currentIteration < numIterations - 1) {
            setTimeout(async () => {
              await runIt(currentIteration + 1);
            }, delayBetweenRequests);
          } else {
            return resolve();
          }
        };

        runIt(0);
      });
    };

    await execute();

    const rows = [];

    results.forEach((r, i) => {
      const request = requests[i];
      const result = results[i];
      const avg = result.total / result.successes;

      let color = "";

      if (result.successes === numIterations) {
        color = "limegreen";
      } else {
        color = "red";
      }

      rows.push(
        `<tr>
              <td>${request.name || request.url}</td>
              <td><font color="${color}">${numIterations}</font></td>
              <td>${avg.toFixed(1)}</td>
              <td>${result.total.toFixed(2)}</td>
            </tr>`,
      );
    });

    const html = startHtml + header + startTableHtml + rows.join("") + endHtml;

    context.app.showGenericModalDialog("Results", { html });
  } catch (err) {
    context.app.alert("Unknown Error Occurred", err.message);
    console.log(err);
  }
};

module.exports.requestGroupActions = [
  {
    label: "Load Test",
    action,
  },
];

module.exports.workspaceActions = [
  {
    label: "Load Test",
    action,
  },
];
