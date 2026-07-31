class BudgetExceeded(Exception):
    pass


class RunBudget:
    def __init__(self, max_calls: int = 20):
        self.max_calls = max_calls
        self._counts: dict[str, int] = {}

    def consume(self, run_id: str, n: int = 1) -> int:
        count = self._counts.get(run_id, 0) + n
        if count > self.max_calls:
            raise BudgetExceeded(f"run {run_id} exceeded budget of {self.max_calls} calls")
        self._counts[run_id] = count
        return count

    def remaining(self, run_id: str) -> int:
        return self.max_calls - self._counts.get(run_id, 0)


budget = RunBudget()
