//! Build-time trust roots. No runtime endpoint or insecure-mode setter exists.
use serde::Deserialize;
use url::Url;

#[derive(Debug)]
pub struct ConfigError;

pub const CALLBACK: &str = "inc.corpora.amp://oauth/callback";

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionConfig {
    pub issuer: Url,
    pub authorization: Url,
    pub token: Url,
    pub jwks: Url,
    pub api: Url,
    pub client_id: String,
    pub resource: String,
    #[serde(default)]
    pub scopes: Vec<String>,
}

fn trusted_https(url: &Url) -> bool {
    url.scheme() == "https"
        && url.port_or_known_default() == Some(443)
        && url.username().is_empty()
        && url.password().is_none()
        && url.query().is_none()
        && url.fragment().is_none()
        && matches!(url.host(), Some(url::Host::Domain(host)) if host.contains('.') && host.trim_end_matches('.') != "localhost" && !host.trim_end_matches('.').ends_with(".localhost"))
}
impl SessionConfig {
    pub fn from_build() -> Result<Option<Self>, ConfigError> {
        let Some(raw) = option_env!("AMP_NATIVE_OIDC_CONFIG") else {
            return Ok(None);
        };
        let config: Self = serde_json::from_str(raw).map_err(|_| ConfigError)?;
        config.validate()?;
        // Public catalog and authenticated learning must describe the same deployment.
        let public_api = option_env!("AMP_NATIVE_API_ORIGIN").ok_or(ConfigError)?;
        if Url::parse(public_api).map_err(|_| ConfigError)? != config.api {
            return Err(ConfigError);
        }
        Ok(Some(config))
    }
    fn validate(&self) -> Result<(), ConfigError> {
        if ![
            &self.issuer,
            &self.authorization,
            &self.token,
            &self.jwks,
            &self.api,
        ]
        .into_iter()
        .all(trusted_https)
            || self.api.path() != "/"
            || self.client_id.is_empty()
            || self.client_id.len() > 256
            || self.client_id.chars().any(char::is_control)
            || self.resource.is_empty()
            || self.resource.len() > 1024
            || self.resource.chars().any(char::is_control)
            || self.scopes.len() > 8
            || self.scopes.iter().any(|scope| {
                scope.is_empty()
                    || scope.len() > 128
                    || !scope
                        .bytes()
                        .all(|c| (0x21..=0x7e).contains(&c) && c != b'"' && c != b'\\')
            })
            || self.authorization == self.token
            || self.token == self.jwks
        {
            return Err(ConfigError);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn endpoints_are_explicit_https_without_ambient_credentials() {
        for value in [
            "http://issuer.example.test",
            "https://127.0.0.1",
            "https://localhost.",
            "https://api.localhost.",
            "https://name:password@issuer.example.test",
            "https://issuer.example.test/?x=1",
            "https://issuer.example.test/#x",
            "https://issuer.example.test:444",
        ] {
            assert!(!trusted_https(&Url::parse(value).unwrap()), "{value}");
        }
        assert!(trusted_https(
            &Url::parse("https://identity.example.test/tenant/token").unwrap()
        ));
    }
}
