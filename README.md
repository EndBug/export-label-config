# Export label config

You can use this action to generate a JSON or YAML file that contains the current label config of one of your repositories.  
This is made with the [EndBug/label-sync](https://github.com/EndBug/label-sync) action in mind, but you can use that data with whatever tool you prefer.

### Example workflow:

```yaml
name: Export label config
on: 
  # You can run this with every event, but it's better to run it only when you actually need it.
  workflow_dispatch:

jobs:
  labels:
    runs-on: ubuntu-latest

    steps:
      - uses: EndBug/export-label-config@v1
        with:
          # This is needed if you're dealing with private repos.
          token: ${{ secrets.GITHUB_TOKEN }}

          # Set this to `true` if you want to get the raw API reponse. Defaults to `false`.
          raw-result: false

          # By default every label entry will have an `aliases` property set to an empty array.
          # It's for EndBug/label-sync, if you don't want it you cans set this to `false`
          add-aliases: true
```

After running your workflow, you'll find the genearted files in the "Artifacts" section of your run.  
To find more about artifacts, please refer to the [GitHub Docs](https://docs.github.com/en/free-pro-team@latest/actions/guides/storing-workflow-data-as-artifacts#about-workflow-artifacts).
