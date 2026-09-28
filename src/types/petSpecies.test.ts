import { readFileSync } from 'fs';
import { join } from 'path';

const schema = readFileSync(
  join(__dirname, '../../supabase/schema.sql'),
  'utf8'
);
const setter = schema.match(
  /create or replace function set_pet_species[\s\S]*?\n\$\$;/
)?.[0];

describe('shared pet species schema', () => {
  it('defaults old and new pets to cat and permits only cat or dog', () => {
    expect(schema).toMatch(
      /add column if not exists species text not null default 'cat'/
    );
    expect(schema).toMatch(
      /pair_pet_species_check\s+check \(species in \('cat', 'dog'\)\)/
    );
  });

  it('changes species only through a caller-pair-scoped function', () => {
    expect(setter).toBeDefined();
    expect(setter).toContain('set_pet_species(new_species text)');
    expect(setter).toContain('where is_pair_member(p, auth.uid())');
    expect(setter).not.toContain('target_pair_id');
    expect(schema).toContain(
      'revoke all on function set_pet_species(text) from public, anon;'
    );
    expect(schema).not.toMatch(/create policy "pair_pet_update/);
  });
});
