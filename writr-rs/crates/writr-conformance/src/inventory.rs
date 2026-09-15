use crate::{normalize, Golden, PROFILES};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

fn json(path: &Path) -> Result<Value, String> {
	serde_json::from_str(
		&std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?,
	)
	.map_err(|e| e.to_string())
}
fn files(dir: &Path) -> Result<Vec<PathBuf>, String> {
	let mut result = Vec::new();
	for e in std::fs::read_dir(dir).map_err(|e| format!("{}: {e}", dir.display()))? {
		let p = e.map_err(|e| e.to_string())?.path();
		if p.is_dir() {
			result.extend(files(&p)?);
		} else {
			result.push(p);
		}
	}
	result.sort();
	Ok(result)
}
fn add(
	out: &mut Vec<Golden>,
	root: &Path,
	id: &str,
	input: PathBuf,
	profiles: &Value,
	suite: &str,
) -> Result<(), String> {
	let profiles = profiles
		.as_array()
		.ok_or_else(|| format!("{id}: missing profile assignments"))?;
	if profiles.is_empty() {
		return Err(format!("{id}: empty profiles"));
	}
	for p in profiles {
		let name = p.as_str().ok_or("invalid profile")?;
		if crate::profile(name).is_none() {
			return Err(format!("{id}: unknown profile {name}"));
		}
		if out
			.iter()
			.any(|g| g.profile == name && g.id == id && g.input_path == input)
		{
			return Err(format!("{name} :: {id}: duplicate case"));
		}
		let golden = root.join(suite).join(name).join(format!("{id}.html"));
		if !input.is_file() || !golden.is_file() {
			return Err(format!("{name} :: {id}: missing input or golden"));
		}
		out.push(Golden {
			profile: name.into(),
			id: id.into(),
			input_path: input.clone(),
			golden_path: golden,
		});
	}
	Ok(())
}
/// Shared JSON inventories define every case. JS additionally verifies SHA-256.
pub fn discover(root: &Path) -> Result<Vec<Golden>, String> {
	let manifest = json(&root.join("corpus/manifest.json"))?;
	let entries = manifest["entries"]
		.as_array()
		.ok_or("missing manifest entries")?;
	if entries.is_empty() || manifest["count"].as_u64() != Some(entries.len() as u64) {
		return Err("manifest count/empty inventory".into());
	}
	let mut out = Vec::new();
	let mut ids = BTreeSet::new();
	let mut counts = BTreeMap::<String, usize>::new();
	for e in entries {
		let id = e["id"].as_str().ok_or("missing case id")?;
		if id.split('/').any(|x| x == ".." || x.is_empty())
			|| id.starts_with('/')
			|| id.contains('\\')
		{
			return Err(format!("invalid id {id}"));
		}
		if !ids.insert(id) {
			return Err(format!("duplicate case {id}"));
		}
		let expected_path = format!("{id}.md");
		if e["path"].as_str() != Some(&expected_path) {
			return Err(format!("{id}: input path differs"));
		}
		let input = root.join("corpus/inputs").join(expected_path);
		let raw = std::fs::read_to_string(&input).map_err(|error| format!("{id}: {error}"))?;
		if normalize(&raw) != raw || e["bytes"].as_u64() != Some(raw.len() as u64) {
			return Err(format!(
				"{} :: {id}: input bytes/normalization differ",
				e["profiles"]
			));
		}
		*counts
			.entry(e["source"].as_str().ok_or("missing source")?.into())
			.or_default() += 1;
		add(&mut out, root, id, input, &e["profiles"], "goldens")?;
	}
	if serde_json::to_value(counts).map_err(|e| e.to_string())? != manifest["bySource"] {
		return Err("manifest source counts differ".into());
	}
	let map = json(&root.join("diagnostics/profiles.json"))?;
	let mut features = BTreeSet::new();
	let mut diagnostic_ids = BTreeSet::new();
	for file in files(&root.join("diagnostics"))? {
		if !file.extension().is_some_and(|e| e == "md" || e == "mdx") {
			continue;
		}
		let id = file
			.strip_prefix(root.join("diagnostics"))
			.map_err(|e| e.to_string())?
			.with_extension("")
			.to_string_lossy()
			.replace('\\', "/");
		if !diagnostic_ids.insert(id.clone()) {
			return Err(format!("duplicate diagnostic {id}"));
		}
		let feature = id.split('/').next().ok_or("missing feature")?;
		features.insert(feature.to_owned());
		add(
			&mut out,
			root,
			&id,
			file,
			&map[feature],
			"diagnostics-goldens",
		)?;
	}
	if diagnostic_ids.is_empty() {
		return Err("empty diagnostic inventory".into());
	}
	for feature in map.as_object().ok_or("invalid diagnostic mapping")?.keys() {
		if !features.contains(feature) {
			return Err(format!("orphan diagnostic mapping {feature}"));
		}
	}
	for profile in PROFILES {
		if !out.iter().any(|g| g.profile == profile.name) {
			return Err(format!("{}: empty required suite", profile.name));
		}
	}
	let expected: BTreeSet<_> = out.iter().map(|g| g.golden_path.clone()).collect();
	for dir in ["goldens", "diagnostics-goldens"] {
		for file in files(&root.join(dir))? {
			if !expected.contains(&file) {
				return Err(format!("orphan golden {}", file.display()));
			}
		}
	}
	let expected_inputs: BTreeSet<_> = out.iter().map(|g| g.input_path.clone()).collect();
	for file in files(&root.join("corpus/inputs"))? {
		if !expected_inputs.contains(&file) {
			return Err(format!("orphan input {}", file.display()));
		}
	}
	Ok(out)
}

#[cfg(test)]
mod tests {
	use super::*;
	use serde_json::json;
	use std::sync::atomic::{AtomicUsize, Ordering};
	static NEXT: AtomicUsize = AtomicUsize::new(0);
	struct Fixture(PathBuf);
	impl Drop for Fixture {
		fn drop(&mut self) {
			let _ = std::fs::remove_dir_all(&self.0);
		}
	}
	impl Fixture {
		fn write(&self, path: &str, content: &str) {
			let path = self.0.join(path);
			std::fs::create_dir_all(path.parent().unwrap()).unwrap();
			std::fs::write(path, content).unwrap();
		}
		fn manifest(&self) -> Value {
			json(&self.0.join("corpus/manifest.json")).unwrap()
		}
		fn save(&self, manifest: &Value) {
			self.write("corpus/manifest.json", &manifest.to_string());
		}
	}
	fn fixture() -> Fixture {
		let dir = Fixture(std::env::temp_dir().join(format!(
			"writr-inventory-{}-{}",
			std::process::id(),
			NEXT.fetch_add(1, Ordering::Relaxed)
		)));
		std::fs::create_dir(&dir.0).unwrap();
		dir.write("corpus/inputs/test/one.md", "Hello\n");
		dir.save(&json!({"count":1,"bySource":{"test":1},"entries":[{"id":"test/one","path":"test/one.md","source":"test","bytes":6,"profiles":["default"]}]}));
		dir.write("goldens/default/test/one.html", "<p>Hello</p>\n");
		dir.write("diagnostics/text/one.md", "Hello\n");
		dir.write(
			"diagnostics/profiles.json",
			&json!({"text":PROFILES.iter().map(|p|p.name).collect::<Vec<_>>()}).to_string(),
		);
		for p in PROFILES {
			dir.write(
				&format!("diagnostics-goldens/{}/text/one.html", p.name),
				"<p>Hello</p>\n",
			);
		}
		dir
	}
	#[test]
	fn expected_cases_do_not_depend_on_golden_discovery() {
		let f = fixture();
		assert_eq!(discover(&f.0).unwrap().len(), 8);
		std::fs::remove_file(f.0.join("goldens/default/test/one.html")).unwrap();
		assert!(discover(&f.0)
			.unwrap_err()
			.contains("default :: test/one: missing input or golden"));
	}
	#[test]
	fn corrupt_inventories_fail_in_disposable_directories() {
		for scenario in [
			"manifest",
			"input",
			"bytes",
			"count",
			"source",
			"duplicate",
			"profile",
			"empty-profile",
			"path",
			"id",
			"orphan-golden",
			"orphan-input",
			"orphan-mapping",
			"duplicate-diagnostic",
			"mapping",
		] {
			let f = fixture();
			let mut m = f.manifest();
			match scenario {
				"manifest" => {
					std::fs::remove_file(f.0.join("corpus/manifest.json")).unwrap();
				}
				"input" => {
					std::fs::remove_file(f.0.join("corpus/inputs/test/one.md")).unwrap();
				}
				"bytes" => f.write("corpus/inputs/test/one.md", "Hello  \n"),
				"orphan-golden" => f.write("goldens/default/test/orphan.html", ""),
				"orphan-input" => f.write("corpus/inputs/test/orphan.md", ""),
				"orphan-mapping" => {
					let mut mapping = json(&f.0.join("diagnostics/profiles.json")).unwrap();
					mapping["orphan"] = json!(["default"]);
					f.write("diagnostics/profiles.json", &mapping.to_string());
				}
				"duplicate-diagnostic" => f.write("diagnostics/text/one.mdx", "Hello\n"),
				"mapping" => f.write("diagnostics/profiles.json", "{}"),
				_ => {
					match scenario {
						"count" => m["count"] = json!(2),
						"source" => m["bySource"]["test"] = json!(2),
						"duplicate" => {
							let entry = m["entries"][0].clone();
							m["entries"].as_array_mut().unwrap().push(entry);
							m["count"] = json!(2);
						}
						"profile" => m["entries"][0]["profiles"] = json!(["unknown"]),
						"empty-profile" => m["entries"][0]["profiles"] = json!([]),
						"path" => m["entries"][0]["path"] = json!("elsewhere.md"),
						"id" => m["entries"][0]["id"] = json!("../outside"),
						_ => unreachable!(),
					}
					f.save(&m);
				}
			}
			assert!(discover(&f.0).is_err(), "{scenario}");
		}
	}
}
