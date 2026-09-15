use serde_json::Value;
use writr_conformance::{harness_dir, PROFILES};
use writr_core::{
	hast::{self, Element, Node, PropertyValue},
	RenderError, RenderOptions,
};

fn report(name: &str, versions: &Value, results: &[Value]) {
	let dir = std::env::var_os("WRITR_REPORT_DIR")
		.map(std::path::PathBuf::from)
		.unwrap_or_else(|| harness_dir().join("../../test-output/parity"));
	std::fs::create_dir_all(&dir).unwrap();
	let commit = std::process::Command::new("git")
		.args(["rev-parse", "HEAD"])
		.output()
		.unwrap();
	let data = serde_json::json!({"suite":name,"mode":"rust","commit":String::from_utf8(commit.stdout).unwrap().trim(),"host":format!("{}-{}",std::env::consts::OS,std::env::consts::ARCH),"versions":versions,"results":results});
	std::fs::write(
		dir.join(format!(
			"{name}-{}-{}.json",
			std::env::consts::OS,
			std::env::consts::ARCH
		)),
		serde_json::to_string_pretty(&data).unwrap(),
	)
	.unwrap();
}

fn options(v: &Value) -> RenderOptions {
	RenderOptions {
		emoji: v["emoji"].as_bool().unwrap(),
		toc: v["toc"].as_bool().unwrap(),
		slug: v["slug"].as_bool().unwrap(),
		highlight: v["highlight"].as_bool().unwrap(),
		gfm: v["gfm"].as_bool().unwrap(),
		math: v["math"].as_bool().unwrap(),
		mdx: v["mdx"].as_bool().unwrap(),
		raw_html: v["rawHtml"].as_bool().unwrap(),
		caching: false,
	}
}
fn fixture() -> Value {
	serde_json::from_str(
		&std::fs::read_to_string(harness_dir().join("exact/outcomes.json")).unwrap(),
	)
	.unwrap()
}
#[test]
fn profiles_match_shared_js_definitions() {
	let shared: Value =
		serde_json::from_str(include_str!("../../../../test/harness/profiles.json")).unwrap();
	assert_eq!(shared.as_array().unwrap().len(), PROFILES.len());
	for p in PROFILES {
		let js = shared
			.as_array()
			.unwrap()
			.iter()
			.find(|v| v["name"] == p.name)
			.unwrap();
		assert_eq!(options(&js["options"]), p.options, "{}", p.name);
	}
}
#[test]
fn exact_public_outcomes_match_current_js() {
	check_public(false);
}
#[test]
fn exact_mdx_outcomes_match_current_js() {
	check_public(true);
}
fn check_public(mdx: bool) {
	let data = fixture();
	let cases = data["cases"].as_array().unwrap();
	assert!(!cases.is_empty());
	let mut failures = Vec::new();
	let mut results = Vec::new();
	for c in cases
		.iter()
		.filter(|c| c["options"]["mdx"].as_bool() == Some(mdx))
	{
		let opts = options(&c["options"]);
		let input = c["input"].as_str().unwrap();
		let expected = &c["outcome"];
		let matched = match writr_core::render(input, &opts) {
			Ok(html) => expected["kind"] == "success" && expected["html"] == html,
			Err(RenderError::Parse(_)) => {
				expected["kind"] == "error" && expected["category"] == "parse"
			}
			Err(e) => panic!("{}: infrastructure failure {e}", c["id"]),
		};
		results.push(serde_json::json!({"id":c["id"],"api":"render","passed":matched}));
		if !matched {
			failures.push(format!("{}: exact render differs from JS", c["id"]));
		}
		let valid = writr_core::validate(input, &opts);
		let matched = match valid {
			Ok(()) => c["validation"]["kind"] == "success",
			Err(RenderError::Parse(_)) => c["validation"]["kind"] == "error",
			Err(e) => panic!("{}: infrastructure failure {e}", c["id"]),
		};
		results.push(serde_json::json!({"id":c["id"],"api":"validate","passed":matched}));
		if !matched {
			failures.push(format!("{}: validate outcome differs from JS", c["id"]));
		}
	}
	report(
		if mdx { "rust-mdx" } else { "rust-public" },
		&data["versions"],
		&results,
	);
	assert!(!results.is_empty(), "required exact suite is empty");
	assert!(
		failures.is_empty(),
		"{} failures:\n{}",
		failures.len(),
		failures.join("\n")
	);
}
fn nodes(v: &Value) -> Vec<Node> {
	v.as_array().unwrap().iter().map(node).collect()
}
fn property(v: &Value) -> PropertyValue {
	if let Some(n) = v["$number"].as_str() {
		return PropertyValue::Number(match n {
			"Infinity" => f64::INFINITY,
			"-Infinity" => f64::NEG_INFINITY,
			"NaN" => f64::NAN,
			_ => panic!("unknown special number"),
		});
	}
	match v {
		Value::Bool(b) => PropertyValue::Bool(*b),
		Value::Number(n) => PropertyValue::Number(n.as_f64().unwrap()),
		Value::String(s) => PropertyValue::String(s.clone()),
		Value::Array(a) => {
			PropertyValue::List(a.iter().map(|v| v.as_str().unwrap().into()).collect())
		}
		_ => panic!("unsupported property {v}"),
	}
}
fn node(v: &Value) -> Node {
	match v["type"].as_str().unwrap() {
		"root" => Node::Root(nodes(&v["children"])),
		"text" => Node::Text(v["value"].as_str().unwrap().into()),
		"raw" => Node::Raw(v["value"].as_str().unwrap().into()),
		"comment" => Node::Comment(v["value"].as_str().unwrap().into()),
		"doctype" => Node::Doctype,
		"element" => {
			let mut e = Element::new(v["tagName"].as_str().unwrap());
			e.children = nodes(&v["children"]);
			for (k, v) in v["properties"].as_object().unwrap() {
				e.properties.push((k.clone(), property(v)));
			}
			if !v["content"].is_null() {
				e.template_content = Some(nodes(&v["content"]["children"]));
			}
			Node::Element(e)
		}
		_ => panic!("unsupported node {v}"),
	}
}
#[test]
fn stage_divergences_match_pinned_js_transforms() {
	let data = fixture();
	let cases = data["stages"].as_array().unwrap();
	assert!(!cases.is_empty());
	let mut failures = Vec::new();
	let mut results = Vec::new();
	for c in cases {
		let mut tree = node(&c["tree"]);
		match c["stage"].as_str().unwrap() {
			"raw" => tree = hast::raw::process(&tree),
			"slug" => hast::slug::transform(&mut tree),
			"stringify" => {}
			_ => panic!("unknown stage"),
		};
		let html = hast::to_html::to_html(
			&tree,
			hast::to_html::Options {
				allow_dangerous_html: true,
			},
		);
		results.push(serde_json::json!({"id":c["id"],"api":c["stage"],"passed":c["outcome"]["html"]==html,"expected":c["outcome"],"actual":{"kind":"success","html":html}}));
		if c["outcome"]["html"] != html {
			failures.push(format!(
				"{} ({}): expected {}, got {:?}",
				c["id"], c["divergence"], c["outcome"]["html"], html
			));
		}
	}
	report("rust-stages", &data["versions"], &results);
	assert!(
		failures.is_empty(),
		"{} stage failures:\n{}",
		failures.len(),
		failures.join("\n")
	);
}
