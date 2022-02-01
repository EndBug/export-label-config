import * as core from '@actions/core'
import * as artifact from '@actions/artifact'
import axios from 'axios'
import tmp from 'tmp'
import yamljs from 'yamljs'
import fs from 'fs'
import path from 'path'

const { endGroup, getInput, startGroup } = core
const log = {
  info: (str: string) => core.info('🛈 ' + str),
  success: (str: string) => core.info('✓ ' + str),
  warning: (str: string, showInReport = true) =>
    core[showInReport ? 'warning' : 'info']('⚠ ' + str),
  error: (str: string, showInReport = true) =>
    core[showInReport ? 'error' : 'info']('✗ ' + str),
  fatal: (str: string) => core.setFailed('✗ ' + str)
}

;(async () => {
  try {
    checkInputs()

    const labels = await fetchLabels()

    await uploadResult(labels)

    log.success(
      'Upload complete! You can find the results in the artifacts of this workflow run.'
    )
  } catch (e) {
    log.fatal(e + '')
  }
})()

function checkInputs() {
  if (!getInput('token'))
    log.warning(
      "You're not passing any `token` option: if your repo is private the action will fail with a 404 error from the GitHub API.",
      false
    )

  if (!['true', 'false'].includes(getInput('raw-result')))
    throw 'The only values you can use for the `raw-result` option are `true` and `false`'

  if (!['true', 'false'].includes(getInput('add-aliases')))
    throw 'The only values you can use for the `add-aliases` option are `true` and `false`'
}

async function fetchLabels() {
  startGroup('Labels fetching')

  const token = getInput('token'),
    rawResult = getInput('raw-result') == 'true',
    addAliases = getInput('add-aliases') == 'true'

  const url = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/labels`,
    headers = token ? { Authorization: `token ${token}` } : undefined
  log.info(`Using following URL: ${url}`)

  const { data } = await axios.get(url, { headers, params: { per_page: 1000 } })
  if (!data || !(data instanceof Array))
    throw "Can't get label data from GitHub API"

  log.success(`${data.length} labels fetched.`)
  endGroup()

  return rawResult
    ? (data as Record<string, string | boolean>[])
    : data.map((element) => ({
        name: element.name as string,
        color: element.color as string,
        description: (element.description as string) || undefined,
        ...(addAliases ? { aliases: [] } : {})
      }))
}

async function uploadResult(labels: Record<string, any>[]) {
  // #region File generation
  startGroup('Files generation')

  const tempDir = tmp.dirSync()
  log.info(`Using temp directory: ${tempDir.name}`)

  const json = JSON.stringify(labels, null, 2),
    yaml = yamljs.stringify(labels, 2, 2),
    errors: ('json' | 'yaml')[] = []

  log.info('Writing JSON file...')
  try {
    fs.writeFileSync(path.join(tempDir.name, 'labels.json'), json)
    log.success('Successfully wrote JSON file.')
  } catch {
    errors.push('json')
  }

  log.info('Writing YAML file...')
  try {
    fs.writeFileSync(path.join(tempDir.name, 'labels.yaml'), yaml)
    log.success('Successfully wrote YAML file.')
  } catch {
    errors.push('yaml')
  }

  if (errors.length >= 2) log.fatal("Couldn't write any of the files.")
  else if (errors.length == 1)
    log.error(`Couldn't write ${errors[0].toUpperCase()} file.`)

  endGroup()
  // #endregion

  // #region Artifact upload
  startGroup('Artifact upload')
  const files = ['labels.json', 'labels.yaml'].filter(
    (f) => !f.endsWith(errors[0])
  )
  log.info(
    `Uploading ${files.length} file${
      files.length == 1 ? '' : 's'
    }: ${files.join(', ')}`
  )

  const response = await artifact
    .create()
    .uploadArtifact(
      'Label config',
      files.map((f) => path.join(tempDir.name, f)),
      tempDir.name
    )
    .catch(() => {
      throw "Couldn't upload any file as artifact."
    })

  if (response) {
    log.info('Artifact result: ' + JSON.stringify(response, null, 2))

    if (response.failedItems.length >= files.length)
      throw "Couldn't upload any file as artifact."
    else if (response.failedItems.length == 1)
      log.error(`Couldn't upload ${response.failedItems[0]} as artifact.`)
    else log.success('Successfully uploaded files.')
  } else {
    log.error("Can't read upload results.", false)
  }
  endGroup()
}
