use super::*;

fn check(value: &str, kind: Kind) -> (Signal, String, usize) {
	let outcome = validate(value, kind, &[], true).unwrap();
	(outcome.signal, outcome.message, outcome.pos)
}

#[test]
fn expressions() {
	assert_eq!(check("1 + 2", Kind::Expression).0, Signal::Ok);
	assert_eq!(check("\"a\" + \"b\"", Kind::Expression).0, Signal::Ok);
	assert_eq!(
		check("({x: {y: \"", Kind::Expression),
		(Signal::Eof, "Unterminated string constant".into(), 9)
	);
	assert_eq!(check("({x: {y: \"}\"}})", Kind::Expression).0, Signal::Ok);
	assert_eq!(check("", Kind::Expression).0, Signal::Ok);
	assert_eq!(
		check("/* } */ ({ok: true})", Kind::Expression).0,
		Signal::Ok
	);
	assert_eq!(check("/* ", Kind::Expression).0, Signal::Eof);
	assert_eq!(check("<A title={\"}\"} />", Kind::Expression).0, Signal::Ok);
	assert_eq!(check("`hello ${\"}\"}`", Kind::Expression).0, Signal::Ok);
	assert_eq!(check("/}/.test(\"}\")", Kind::Expression).0, Signal::Ok);
	assert_eq!(
		check("a b", Kind::Expression),
		(
			Signal::Error,
			"Unexpected content after expression".into(),
			1
		)
	);
	assert_eq!(check("1 +", Kind::Expression).0, Signal::Eof);
}

#[test]
fn attributes_and_spreads() {
	assert_eq!(check("1 + 2", Kind::Attribute).0, Signal::Ok);
	assert_eq!(
		check("", Kind::Attribute),
		(Signal::Error, "Unexpected empty expression".into(), 0)
	);
	assert_eq!(check("...props", Kind::Spread).0, Signal::Ok);
	assert_eq!(
		check("x: 1", Kind::Spread),
		(Signal::Error, "Expected a spread element".into(), 0)
	);
	assert_eq!(
		check("...x, ...y", Kind::Spread),
		(Signal::Error, "Only a single spread is supported".into(), 6)
	);
}

#[test]
fn esm() {
	let outcome = validate("import Thing from \"pkg\"", Kind::Esm, &[], true).unwrap();
	assert_eq!(outcome.signal, Signal::Ok);
	assert_eq!(outcome.imports, vec!["Thing".to_string()]);
	assert_eq!(check("export const value = 42", Kind::Esm).0, Signal::Ok);
	assert_eq!(
		check("export const x = 1;\nconsole.log(x)", Kind::Esm),
		(
			Signal::Error,
			"Only import/export statements are supported".into(),
			20
		)
	);
	let deferred = validate("export {Missing}", Kind::Esm, &[], true).unwrap();
	assert_eq!(deferred.signal, Signal::Ok);
	let strict = validate("export {Missing}", Kind::Esm, &[], false).unwrap();
	assert_eq!(strict.message, "Export 'Missing' is not defined");
	let imported = validate("export {Thing}", Kind::Esm, &["Thing".into()], false).unwrap();
	assert_eq!(imported.signal, Signal::Ok);
	assert_eq!(check("export const = 1", Kind::Esm).0, Signal::Error);
}
