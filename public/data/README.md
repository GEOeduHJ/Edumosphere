# GeoJSON 데이터 폴더

이 폴더에 국가/도시 경계 GeoJSON 파일을 넣어주세요.

권장 파일명: world-countries.geojson
경로(앱에서 자동 로드): `/data/world-countries.geojson`
형식: GeoJSON FeatureCollection (Polygon / MultiPolygon)

권장 속성(라벨/아이디): `ADMIN`, `name`, `country_name`, `ISO_A3` 등

동작 요약:
- 파일을 추가하면 앱이 `/data/world-countries.geojson`을 불러와 지도에 렌더링합니다.
- Hover로 툴팁 표시, 클릭으로 선택/해제, 선택은 로컬스토리지에 저장됩니다.

문제가 있거나 다른 파일을 사용하려면 알려주세요.
