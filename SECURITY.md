# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| Latest  | ✅ Yes             |
| Older   | ❌ No              |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Email **jamesdhooks@gmail.com** with a description of the vulnerability.
3. Include steps to reproduce, if possible.
4. Allow up to 72 hours for an initial response.

## Security Considerations

- **API keys** are stored locally in `config.json` (git-ignored). Never commit your API key.
- **All processing** happens locally on your machine, except for calls to the Google Gemini API.
- **No telemetry** is collected — this tool does not phone home.
- The app binds to `localhost` only and is not designed for network-facing deployment.

## Dependencies

This project depends on third-party packages (Python and npm). Keep dependencies up to date
and review them periodically for known vulnerabilities.
