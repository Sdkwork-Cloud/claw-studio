use std::fmt::{Display, Formatter};
use std::fs;
use std::path::Path;

use serde::Serialize;
use serde::de::DeserializeOwned;

#[derive(Debug)]
pub enum JsonFileStoreError {
    Io(std::io::Error),
    Serialize(serde_json::Error),
    Deserialize(serde_json::Error),
}

impl Display for JsonFileStoreError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            JsonFileStoreError::Io(error) => write!(f, "file store io error: {error}"),
            JsonFileStoreError::Serialize(error) => {
                write!(f, "file store serialization error: {error}")
            }
            JsonFileStoreError::Deserialize(error) => {
                write!(f, "file store deserialization error: {error}")
            }
        }
    }
}

impl std::error::Error for JsonFileStoreError {}

pub fn load_or_seed_json_file<T>(
    path: &Path,
    seed: impl FnOnce() -> T,
) -> Result<T, JsonFileStoreError>
where
    T: Serialize + DeserializeOwned,
{
    if path.exists() {
        let content = fs::read_to_string(path).map_err(JsonFileStoreError::Io)?;
        return serde_json::from_str(&content).map_err(JsonFileStoreError::Deserialize);
    }

    let seeded = seed();
    save_json_file(path, &seeded)?;
    Ok(seeded)
}

pub fn save_json_file<T>(path: &Path, value: &T) -> Result<(), JsonFileStoreError>
where
    T: Serialize,
{
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(JsonFileStoreError::Io)?;
    }

    let content = serde_json::to_string_pretty(value).map_err(JsonFileStoreError::Serialize)?;
    fs::write(path, content).map_err(JsonFileStoreError::Io)
}
