/*
 *
 * First call to register:
{
    "options": {
        "challenge": "LuWANiurP2C1TV9zGj_kjph8mEiwVVhAR0e8VkvnenI",
        "rp": {
            "name": "Buy X post",
            "id": "localhost"
        },
        "user": {
            "id": "MjU1NzkzZjYtNmY2MC00NjQ1LWJhNjItNWNjNzU0YTI0Y2Vm",
            "name": "Matteo_Mer",
            "displayName": ""
        },
        "pubKeyCredParams": [
            {
                "alg": -7,
                "type": "public-key"
            },
            {
                "alg": -257,
                "type": "public-key"
            }
        ],
        "timeout": 60000,
        "attestation": "direct",
        "excludeCredentials": [],
        "authenticatorSelection": {
            "authenticatorAttachment": "platform",
            "requireResidentKey": true,
            "residentKey": "required",
            "userVerification": "required"
        },
        "extensions": {
            "credProps": true
        }
    },
    "userId": "255793f6-6f60-4645-ba62-5cc754a24cef",
    "username": "Matteo_Mer"

   2nd call, verify:

response:  {
    "id": "ENEjA6Y4T06H-GvYY6sOwQ",
    "rawId": "ENEjA6Y4T06H-GvYY6sOwQ",
    "response": {
        "attestationObject": "o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YViUSZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NdAAAAANVIgm55tNtAo9gREW9-g0kAEBDRIwOmOE9Oh_hr2GOrDsGlAQIDJiABIVgg2JC3wJw4gR2Dnye6YNtOZrYQnV0WHR_cvyh2KH9iYUMiWCDvIz5HvwWwISWetQqqiMICJzaR97jP0rqKp2Jbl7u0eA",
        "clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoicmZMZzNWa1p0WGFmeU5DYi10VnJ3bmVINnk5RTNfSjBSVnRrSjc2QXpGOCIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCIsImNyb3NzT3JpZ2luIjpmYWxzZX0",
        "transports": [
            "internal"
        ],
        "publicKeyAlgorithm": -7,
        "publicKey": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE2JC3wJw4gR2Dnye6YNtOZrYQnV0WHR_cvyh2KH9iYUPvIz5HvwWwISWetQqqiMICJzaR97jP0rqKp2Jbl7u0eA",
        "authenticatorData": "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NdAAAAANVIgm55tNtAo9gREW9-g0kAEBDRIwOmOE9Oh_hr2GOrDsGlAQIDJiABIVgg2JC3wJw4gR2Dnye6YNtOZrYQnV0WHR_cvyh2KH9iYUMiWCDvIz5HvwWwISWetQqqiMICJzaR97jP0rqKp2Jbl7u0eA"
    },
    "type": "public-key",
    "clientExtensionResults": {
        "credProps": {
            "rk": true
        }
    },
    "authenticatorAttachment": "platform"
}}*/

fn verify_attestation(json_data: &str) -> Result<(), Box<dyn std::error::Error>> {
    let response: webauthn_rs::prelude::RegisterPublicKeyCredential =
        serde_json::from_str(json_data)?;
    Ok(())
}
