# insomnia-plugin-load-test-timing

[![npm version](https://badge.fury.io/js/insomnia-plugin-load-test-timing.svg)](https://badge.fury.io/js/insomnia-plugin-load-test-timing)

This plugin adds an option to each folder's drop-down menu that allows you to run all the requests in the folder and gather timing information.

## Input Dialogs

When run, you will be asked three questions:

### # Iterations

The number of times to issue the requests for all the requests in the folder

### # Seconds

Delay between request runs, in seconds.

### # Run in parallel

If yes, it will run all requests in folder for each run. If no, it will run each request serially.

## Output Table

When the runs are finished you will be presented with tabular result set showing the average and total timings of each request in the folder.

The `Successes` column will show the # of total http requests sent out. Ideally, the number in this column is equal to the [# Iterations] \* [# requests in folder]. If it is not equal to this, then the number of failures is ([# Iterations] \_ [# requests in folder]) \* [# of requests that returned a non 2xx status code], and it will be colored RED for failure. A correct # of successes will be colored GREEN.

This plugin is published in [npm](https://www.npmjs.com/package/insomnia-plugin-load-test-timing). To use it you can install it from your [insomnia.rest](https://insomnia.rest/) client by going into **Preferences -> Plugins** and entering the package name `insomnia-plugin-load-test-timing` then click "Install Plugin".
