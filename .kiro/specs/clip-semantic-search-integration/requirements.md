# Requirements Document

## Introduction

This feature integrates CLIP (Contrastive Language-Image Pre-training) semantic matching into the existing hybrid missing person search system. The system currently uses structured attribute matching (gender, height, skin tone, hair color, etc.) to score candidates. CLIP will add a second ranking stage that uses multimodal AI to match natural language descriptions against face images, improving match quality when text descriptions are available.

## Glossary

- **Search_API**: The Next.js API route at `/api/missing-reports/search` that orchestrates the hybrid search
- **CLIP_Service**: The Python Flask service running on port 5001 that provides CLIP model inference
- **CLIP_Client**: The JavaScript module at `sahaay/lib/ai/clipMatching.js` that calls the CLIP_Service
- **Missing_Report**: A database record describing a missing person with structured attributes and optional free-text fields
- **Candidate**: A registered user record with face image that may match a Missing_Report
- **Attribute_Score**: Numeric score (0-100) based on matching structured fields like gender, height, skin_tone
- **CLIP_Similarity**: Cosine similarity score (0.0-1.0) between text description and face image embeddings
- **Hybrid_Score**: Combined score using both Attribute_Score and CLIP_Similarity for final ranking
- **Description_Builder**: Function that converts structured attributes into natural language text
- **Supabase_Storage**: Cloud storage service hosting face images at `selfie_url` field

## Requirements

### Requirement 1: Natural Language Description Generation

**User Story:** As a camp admin, I want the system to convert structured attributes into natural language, so that CLIP can understand the missing person description.

#### Acceptance Criteria

1. WHEN a Missing_Report contains structured attributes, THE Description_Builder SHALL generate a natural language description combining all available fields
2. THE Description_Builder SHALL include age range in format "age X-Y" when age_min and age_max are present
3. THE Description_Builder SHALL include gender, height, build, and skin_tone when present
4. THE Description_Builder SHALL format hair attributes as "length color hair" when both hair_length and hair_color are present
5. THE Description_Builder SHALL include facial_hair, distinguishing_marks, accessories, clothing_description, and identifying_details when present
6. THE Description_Builder SHALL join all parts with commas to form a single description string
7. WHEN no structured attributes are present, THE Description_Builder SHALL return an empty string

### Requirement 2: CLIP Service Integration

**User Story:** As a camp admin, I want the search system to call the CLIP service with candidate images, so that semantic matching can rank results.

#### Acceptance Criteria

1. WHEN use_clip parameter is true, THE Search_API SHALL call CLIP_Client.rankWithCLIP() with the Missing_Report and candidates
2. THE CLIP_Client SHALL send a POST request to CLIP_Service at `/clip-rank` endpoint
3. THE CLIP_Client SHALL include the natural language description and candidate array in the request body
4. THE CLIP_Client SHALL map each candidate's selfie_url to image_url field for CLIP_Service
5. THE CLIP_Client SHALL preserve all candidate fields (id, name, phone, gender, match_score, matched_attributes) in the request
6. WHEN CLIP_Service returns successfully, THE CLIP_Client SHALL return candidates sorted by clip_similarity descending
7. THE CLIP_Client SHALL set request timeout to 30 seconds to handle multiple image downloads


### Requirement 3: CLIP Similarity Scoring

**User Story:** As a camp admin, I want each candidate to have a CLIP similarity score, so that I can see how well the face image matches the text description.

#### Acceptance Criteria

1. THE CLIP_Service SHALL encode the text description using CLIP text encoder
2. THE CLIP_Service SHALL normalize text embeddings to unit length
3. FOR ALL candidates with valid image_url, THE CLIP_Service SHALL download the image from Supabase_Storage
4. THE CLIP_Service SHALL encode each face image using CLIP image encoder
5. THE CLIP_Service SHALL normalize image embeddings to unit length
6. THE CLIP_Service SHALL calculate cosine similarity between text and image embeddings
7. THE CLIP_Service SHALL add clip_similarity field (0.0-1.0) to each candidate
8. WHEN image download fails, THE CLIP_Service SHALL set clip_similarity to 0.0 and add clip_error field
9. THE CLIP_Service SHALL return candidates sorted by clip_similarity descending

### Requirement 4: Graceful Degradation

**User Story:** As a camp admin, I want the search to work even when CLIP service is unavailable, so that I can still find missing persons using attribute matching.

#### Acceptance Criteria

1. WHEN CLIP_Service is unreachable, THE CLIP_Client SHALL catch the network error and log a warning
2. WHEN CLIP_Service returns HTTP error status, THE CLIP_Client SHALL catch the error and log the status code
3. WHEN CLIP ranking fails for any reason, THE CLIP_Client SHALL return the original candidates unchanged
4. THE Search_API SHALL return attribute-based matches when CLIP_Client returns original candidates
5. THE CLIP_Client SHALL provide checkCLIPHealth() function that returns true when CLIP_Service responds to /health endpoint
6. THE checkCLIPHealth() function SHALL timeout after 2 seconds to avoid blocking the search


### Requirement 5: Hybrid Score Combination

**User Story:** As a camp admin, I want the final ranking to combine both attribute matching and CLIP similarity, so that I get the best of both structured and semantic matching.

#### Acceptance Criteria

1. WHEN use_clip is true and CLIP ranking succeeds, THE Search_API SHALL combine Attribute_Score and CLIP_Similarity into Hybrid_Score
2. THE Search_API SHALL calculate Hybrid_Score as: (Attribute_Score * 0.4) + (CLIP_Similarity * 60)
3. THE Search_API SHALL sort candidates by Hybrid_Score descending
4. THE Search_API SHALL preserve both match_score and clip_similarity fields in the response
5. THE Search_API SHALL return top 10 candidates after hybrid ranking
6. WHEN use_clip is false, THE Search_API SHALL return candidates sorted by Attribute_Score only

### Requirement 6: Configuration Management

**User Story:** As a system administrator, I want to configure the CLIP service URL, so that I can deploy the service on different environments.

#### Acceptance Criteria

1. THE CLIP_Client SHALL read FACE_SERVICE_URL from environment variables
2. WHEN FACE_SERVICE_URL is not set, THE CLIP_Client SHALL default to 'http://localhost:5001'
3. THE Search_API SHALL accept use_clip parameter in request body to enable CLIP ranking
4. WHEN use_clip is not provided, THE Search_API SHALL default to false
5. THE Search_API SHALL accept limit parameter to control maximum candidates returned
6. WHEN limit is not provided, THE Search_API SHALL default to 50 candidates


### Requirement 7: Performance Optimization

**User Story:** As a camp admin, I want CLIP ranking to run only on filtered candidates, so that search results return quickly even with thousands of registered users.

#### Acceptance Criteria

1. THE Search_API SHALL calculate Attribute_Score for all users before calling CLIP_Client
2. THE Search_API SHALL sort candidates by Attribute_Score descending
3. THE Search_API SHALL pass only top 50 candidates to CLIP_Client.rankWithCLIP()
4. THE CLIP_Service SHALL process images in sequence to avoid memory overflow
5. THE CLIP_Service SHALL set image download timeout to 5 seconds per image
6. WHEN total CLIP ranking time exceeds 30 seconds, THE CLIP_Client SHALL timeout and return original candidates

### Requirement 8: Logging and Observability

**User Story:** As a developer, I want detailed logs of CLIP ranking operations, so that I can debug issues and monitor performance.

#### Acceptance Criteria

1. WHEN CLIP ranking starts, THE CLIP_Client SHALL log the number of candidates and the generated description
2. WHEN CLIP ranking completes, THE CLIP_Client SHALL log the top 3 similarity scores
3. WHEN CLIP ranking fails, THE CLIP_Client SHALL log the error message
4. THE CLIP_Service SHALL log errors for individual image processing failures
5. THE CLIP_Service SHALL include candidate ID in error logs for traceability
6. THE Search_API SHALL include clip_enabled flag in response metadata when use_clip is true


### Requirement 9: CLIP Service Health Monitoring

**User Story:** As a system administrator, I want to check if the CLIP service is running, so that I can troubleshoot deployment issues.

#### Acceptance Criteria

1. THE CLIP_Service SHALL provide a /health endpoint that returns HTTP 200 when operational
2. THE /health endpoint SHALL return JSON with status field set to "ok"
3. THE /health endpoint SHALL include model field indicating the CLIP model name
4. THE CLIP_Client.checkCLIPHealth() SHALL return true when /health returns status "ok"
5. THE CLIP_Client.checkCLIPHealth() SHALL return false when /health is unreachable or returns non-200 status
6. THE CLIP_Client.checkCLIPHealth() SHALL timeout after 2 seconds

### Requirement 10: Response Format Consistency

**User Story:** As a frontend developer, I want consistent response formats from the search API, so that I can reliably display results.

#### Acceptance Criteria

1. THE Search_API SHALL return matches array containing candidate objects
2. WHEN use_clip is true and CLIP ranking succeeds, THE Search_API SHALL include clip_similarity field in each match
3. WHEN use_clip is true and CLIP ranking fails, THE Search_API SHALL omit clip_similarity field
4. THE Search_API SHALL always include match_score, matched_attributes, and match_confidence fields
5. THE Search_API SHALL include total_candidates count in response
6. THE Search_API SHALL include filters_applied object showing which filters were used
7. WHEN CLIP ranking is requested but not implemented, THE Search_API SHALL include message field explaining the status

