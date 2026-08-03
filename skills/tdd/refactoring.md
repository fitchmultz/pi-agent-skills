# Refactor Candidates

After TDD cycle, while tests are green, look for:

- **Duplication** → delete or extract only when the name makes behavior clearer
- **Long methods** → split only along real concepts; keep tests on public interface
- **Shallow modules** → Combine or deepen
- **Feature envy** → Move logic to where data lives
- **Primitive obsession** → introduce a type/value object only when repeated validation or behavior exists
- **Existing code** the new code reveals as problematic
Skip cleanup that needs a product choice, broad rewrite, or new abstraction without current duplication.
