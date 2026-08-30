# Third-party notices

## Adult-domain data

ReflectBlock's Adult Content Shield includes a generated snapshot of the adult-domain
extension from [StevenBlack/hosts](https://github.com/StevenBlack/hosts), obtained
on 30 August 2026. The source project is licensed under the MIT License.

The snapshot is converted into Chrome Declarative Net Request rules by
`scripts/build-adult-rules.mjs`. It is a domain-level filter, not a guarantee that
every adult page, new domain, VPN, proxy, or non-browser app will be blocked.
