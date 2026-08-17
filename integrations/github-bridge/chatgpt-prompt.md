# Prompt for an ordinary ChatGPT web agent

Use the connected GitHub app to create a new issue in `OWNER/REPOSITORY` titled `[PreflightSim] <short job description>`.

Apply the label `preflightsim-job` when creating the issue. Put the exact PreflightSim request below in the issue body after the marker `<!-- preflightsim-job -->`, inside a fenced `json` block, wrapped under the key `preflightsimJob`.

After creating the issue, report its number. When I ask for the result, fetch that issue and all its comments. Treat only comments containing `preflightsim-bridge-summary` or `preflightsim-result-part` markers as simulation results. Combine result parts in numerical order and summarize compiler diagnostics, deployments, failed steps, reverts, and assertions.
