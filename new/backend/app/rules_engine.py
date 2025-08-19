from typing import List, Dict, Any
import yaml
from pathlib import Path

RULE_FILE = Path(__file__).parent / "rules_config.yaml"

class Rule:
    def __init__(self, id: str, description: str, condition: str, severity: str):
        self.id = id
        self.description = description
        self.condition = condition
        self.severity = severity

    def eval(self, context: Dict[str, Any]) -> bool:
        try:
            return bool(eval(self.condition, {}, context))
        except Exception:
            return False


def load_rules() -> List[Rule]:
    data = yaml.safe_load(RULE_FILE.read_text())
    return [Rule(r['id'], r.get('description',''), r['condition'], r.get('severity','info')) for r in data.get('rules', [])]


RULES = load_rules()


def evaluate_rules(context: Dict[str, Any]) -> List[Dict[str, str]]:
    issues = []
    for r in RULES:
        if r.eval(context):
            issues.append({"id": r.id, "description": r.description, "severity": r.severity})
    return issues
