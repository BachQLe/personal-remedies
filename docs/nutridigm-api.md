swagger: '2.0'
info:
  description:
    "**Nutridigm API Specification** from Personal Remedies. This set of APIs is about food-disease interactions. It provides data on the relationship between various food items and various combinations of diseases or health conditions. The API can answer which food is helpful or harmful for a given set of conditions, and how helpful or harmful. In our knowledgebase, we maintain data on 300+ health conditions, health risks, allergies, diets and medications. In the current implementation of API, we have included data on the most common health issues (such as high blood pressure, diabetes, etc.). In the API, each health condition is identified by a unique 'healthConditionID'. In our knowledgebase, in addition to the most common food items, we also maintain data on various vitamins, minerals, nutrients, herbal supplements, alternative therapies and a limited number of recipes. In the API, all such items are identified by a unique ‘foodItemID’. Most API features will require two parameters: one for health condition(s) and one for the food item or food group.\n
    
    **TIP**: Start with the API \"topdoordonts\" which will produce the list of most helpful or most harmful food items for a specific set of health condition. The foodItemIDs and FoodGroupIDs are numeric and can be looked-up via ‘fooditems’ and ‘foodgroups’ features of the API respectively."
  
  version: '3'
  title: Nutridigm API Specification (by Personal Remedies)
  termsOfService: http://swagger.io/terms/
  contact:
    email: info@personalremedies.com
  license:
    name: Apache 2.0
    url: http://www.apache.org/licenses/LICENSE-2.0.html
paths:
  /healthconditions:
    get:
      summary: Get full list of Health Conditions
      description: "This feature returns the complete list of health conditions, illnesses, health risks and issues, well- being of various organs and systems, medications, weight loss diets, allergies and dietary preferences. The information returned for each entry includes a unique numeric ID (healthConditionID) and a descriptive text for that entry. The list is sorted on description. There are gaps in the list of healthConditionIDs. We have assigned numeric IDs to some conditions for which we have not yet completed our research and thus not included the food-disease interaction information about them in our knowledgebase. "
      tags:
        - healthconditions
      produces:
        - application/json
      parameters:
        - in: query
          name: subscriptionID
          type: string
          required: true
      responses:
        200:
          description: Success
          schema:
            $ref: "#/definitions/AllHealthConditions"
        401:
          description: Subscription ID Error
          schema:
            $ref: "#/definitions/401Error"
        500:
          description: Database Error
          schema:
            $ref: "#/definitions/500Error"

  /fooditems:
    get:
      summary: Get full list of Food Items
      description: This feature returns the complete list of Food Items, nutrients, herbal supplements, Alternative Therapies and miscellaneous items referenced by other features in our knowledgebase. The information returned for each Item includes the Item’s unique numeric ID, the descriptive text for the Item (used internally), the descriptive text that is displayed in output texts produced by other features, food grouping indicators referred to as coarseFoodGroup and fineFoodGroup. Valid values for coarseFoodGroup and fineFoodGroup are described under the Food Groups feature.
      tags:
      - fooditems
      produces:
      - application/json
      parameters:
      - in: query
        name: subscriptionID
        type: string
        required: true
      responses:
        200: 
          description: Success
          schema:
            $ref: '#/definitions/AllFoodItems'
        401:
          description: Subscription ID Error
          schema:
            $ref: '#/definitions/401Error' 
        500:
          description: Database Error
          schema:
            $ref: '#/definitions/500Error'

  /foodgroups:
    get:
      summary: Get full list of Food Groups
      description: "This feature returns the list of food groups used in various features and their descriptions. Valid values for coarseFoodGroup are: b, c, d, e, f, g, h, i, j, k and l. Valid values for fineFoodGroup are: b1, b2, b3, c1, c2, c3, d, e, f, g1, g2, h1, h2, i1, i2, j1, k1, k2 and l. Note that there is no food group 'a'."
      tags:
      - foodgroups
      produces:
      - application/json
      parameters:
      - in: query
        name: subscriptionID
        type: string
        required: true
      responses:
        200: 
          description: Success
          schema:
            $ref: '#/definitions/AllFoodGroups'
        401:
          description: Subscription ID Error
          schema:
            $ref: '#/definitions/401Error' 
        500:
          description: Database Error
          schema:
            $ref: '#/definitions/500Error'

  /goodfor:
    get:
      summary: Determine how "good" certain food is for a set of conditions
      description: "This feature is a very unique and powerful feature. For any pairing of a set of health conditions and food item, it returns a value that denotes the helpfulness or harmfulness of the specified food item for the specified health condition(s). This feature answers the following type of question: Is (pick any food item, ingredient, recipe, herbal med, alternative therapy) good for (pick any combination of illness, health risk, health concern, allergy, weight loss diet)? E.g., Is(snow crab) good for (cervical cancer)? The response to the question is composed of three entries: a numeric value, a descriptive suggestion or answer to the question (string), and a comment or note that might accompany it. The valid answers are: Most Helpful, More Helpful, Helpful, Neutral/OK, Consume Less, Consume Much Less, and Avoid. Helpful items will improve the specified condition. Harmful items will aggravate or worsen the specified condition. Neutral/OK items have no impact. Those food items for which we have not found any data or research on the interaction between the specified item and the specified condition(s) will also be designated as Neutral/OK. In case of common food items familiar to the human diet, such items may be OK to consume. In the case of a 400 result status, the body will contain a 'code' field that specifies which parameter was bad; either the Health Condition or the Food Item."
      tags:
      - goodfor
      produces:
      - application/json
      parameters:
      - in: query
        name: subscriptionID
        type: string
        required: true
      - in: query
        name: foodItemID
        description: Food Item ID
        type: number
        required: true
      - in: query
        name: healthConditionID
        description: Health Condition ID; Single number or comma separated list/array e.g. 1,32,2
        type: string
        required: true
      responses:
        200: 
          description: Rating of how good this food item is for condition
          schema:
            $ref: '#/definitions/GoodFor'
        400:
          description: Bad parameters
          schema:
            $ref: '#/definitions/BadParams' 
        401:
          description: Subscription ID Error
          schema:
            $ref: '#/definitions/401Error' 
        500:
          description: Database Error
          schema:
            $ref: '#/definitions/500Error'

  /suggest:
    get:
      summary: Get a list of best choices with a Food Group for a set of conditions
      description: "This feature is another very unique and powerful feature. For any pairing of a set of health conditions and a food group (fineFoodGroup), it returns a list of the most helpful (or least harmful) food suggestions within the specified food group for the specified health condition. Along with each suggested item, there is an advisory suggestion (called description) and a note that accompanies that item. The note can be be blank, but the advisory suggestion is always included along with its numeric translation 'descriptionNumericID'. This feature answers the following type of question: What are the best (pick any food group, e.g., fish, nuts and seeds, vegetables, herbal supplements, alternative therapy) for (pick any combination of illness, health risk, health concern, allergy, weight loss diet, e.g., high blood pressure, gout, leaky gut)? The returned list is sorted with the most helpful items presented first. For a list of valid values for fineFoodGroup please refer to the FoodGroup feature description. For a list of valid health conditions (aka healthConditionIDs), please see the HealthConditions feature. For a list of valid advisory suggestions, please see GoodFor feature. "
      tags:
      - suggest
      produces:
      - application/json
      parameters:
      - in: query
        name: subscriptionID
        type: string
        required: true
      - in: query
        name: healthConditionID
        description: Health Condition ID; Single number or comma separated list/array e.g. 1,32,2
        type: string
        required: true
      - in: query
        name: fineFoodGroup
        description: Which fine food group to use
        type: string
        required: true
      responses:
        200: 
          description: Success
          schema:
            $ref: '#/definitions/AllSuggests'
        220:
          description: Request succeeded but no data found; Empty array returned
        400:
          description: Bad parameters
          schema:
            $ref: '#/definitions/BadParams' 
        401:
          description: Subscription ID Error
          schema:
            $ref: '#/definitions/401Error' 
        500:
          description: Database Error
          schema:
            $ref: '#/definitions/500Error'


  /topdoordonts:
    get:
      summary: "Get a list of top foods to either consume or avoid for a given set of health conditions"
      description: "Returns a sorted list of either the most helpful foods to consume or the most harmful foods to avoid. Specify  your health condition of interest or a comma-list of conditions and whether interested in consume or avoid."
      tags:
      - topdosordonts
      produces:
      - application/json
      parameters:
      - in: query
        name: subscriptionID
        type: string
        required: true
      - in: query
        name: healthConditionID
        type: string
        required: true
        description: Health Condition ID; Single number or comma separated list/array e.g. 1,32,2
      - in: query
        name: consumeOrAvoid
        description: Must be one of 'consume' or 'avoid'
        type: string
        required: true
      - in: query
        name: limit
        description: Limit the output to max number of items
        type: number
        required: false
      responses:
        200: 
          description: Array of objects
          schema:
            type: array
            items:
              $ref: '#/definitions/TopItems'
        220:
          description: Request succeeded but no data found; Empty array returned
        400:
          description: Bad parameters
          schema:
            $ref: '#/definitions/BadParams' 
        401:
          description: Subscription ID Error
          schema:
            $ref: '#/definitions/401Error' 
        500:
          description: Database Error
          schema:
            $ref: '#/definitions/500Error'

  
  /detailed:
    get:
      summary: "Get a detailed list of helpful, harmful or neutral food items within a Food Group"
      description: "This feature is another very unique and powerful feature. For any pairing of a set of health conditions and a food group (coarseFoodGroup), it returns one of the three lists (array) of the most helpful or the most harmful or neutral common food suggestions within the specified food group for the specified health condition(s). In case of the helpful list, the most helpful items are presented first. In case of the harmful list, the most harmful items are presented first. In case of the Neutral list, better options are presented first. In all three lists, items that are equally helpful or harmful are listed in alphabetic order. Some items may be followed by a note within parenthesis to provide more details or clarification. For a list of valid values for coarseFoodGroup please refer to the FoodGroup feature description. For a list of valid health conditions (aka healthConditionIDs), please see the HealthConditions feature. The helpful list option of this feature is different from the Suggest feature in three ways: 1) it will only contain helpful items; 2) it is designed to list more common or widely known food items; 3) The food groupings in this feature are broader than the Suggest feature. In the event of a 400 result, the 'code' value will be either IVHEALTHCONDITIONID or NOFOODITEMSFORGROUP or IVCOARSEFOODGROUPID."
      tags:
      - detailed
      produces:
      - application/json
      parameters:
      - in: query
        name: subscriptionID
        type: string
        required: true
      - in: query
        name: healthConditionID
        type: string
        required: true
        description: Health Condition ID; Single number or comma separated list/array e.g. 1,32,2
      - in: query
        name: coarseFoodGroup
        description: Coarse Food group
        type: string
        required: true
      - in: query
        name: listType
        type: string
        description: Must be one of "helpful", "neutral", "harmful"
        required: true
      responses:
        200: 
          description: Array of objects
          schema:
            type: array
            items:
              $ref: '#/definitions/Detailed'
        220:
          description: Request succeeded but no data found; Empty array returned
        400:
          description: Bad parameters
          schema:
            $ref: '#/definitions/BadParams' 
        401:
          description: Subscription ID Error
          schema:
            $ref: '#/definitions/401Error' 
        500:
          description: Database Error
          schema:
            $ref: '#/definitions/500Error'


  /references:
    get:
      summary: "Retrieve the list of references for a specific food and health condition pairing."
      description: "Retrieve the list of references for a specific food and health condition pairing."
      tags:
      - references
      produces:
      - application/json
      parameters:
      - in: query
        name: subscriptionID
        type: string
        required: true
      - in: query
        name: healthConditionID
        type: number
        required: true
        description: Health Condition ID
      - in: query
        name: foodItemID
        type: number
        required: true
        description: Food ID
      responses:
          200: 
            description: Array of references
            schema:
              type: array
              items:
                type: string
          400:
            description: Bad parameters
            schema:
              $ref: '#/definitions/BadParams' 
          401:
            description: Subscription ID Error
            schema:
              $ref: '#/definitions/401Error' 
          500:
            description: Database Error
            schema:
              $ref: '#/definitions/500Error'

  

host: 5jocnrfkfb.execute-api.us-east-1.amazonaws.com
basePath: /PersonalRemedies/nutridigm/api/v2/
schemes:
 - https
 - http
 
components:
  schemas:
    ErrorCodes:
      type: string
      enum: [SUBSCRIPTONIDMISSING, IVSUBSCRIPTIONID, DBERROR, IVHEALTHCODE, NOTCURATED, IVFOODITEM,  LOOKUPGREATER1, NOFOODITEMSFORGROUP, BADGROUP, IVCONDITION, APIDAILYLIMITREACHED, NOTAUTHORIZEDHEALTHID]

definitions:
  Error:
    type: object
    properties:
      ok:
        type: boolean
        default: false
      code:
        $ref: '#/components/schemas/ErrorCodes'
      message:
        type: string
 
  BadParams:
    type: object
    properties:
      ok:
        type: boolean
        default: false
      code:
        type: string
        default: "IVFOODITEMID|IVHEALTHCONDTIONID|IVCOARSEFOODGROUPID|IVFINEGROUP|LOOKUPGREATER1"
      message:
        type: string

  401Error:
    type: object
    properties:
      ok:
        type: boolean
        default: false
      code:
        type: string
        default: "SUBSCRIPTONIDMISSING|IVSUBSCRIPTIONID|ACCOUNTDISABLED|ACCOUNTEXPIRED|APIDAILYLIMITREACHED"
      message:
        type: string
 
 
  500Error:
    type: object
    properties:
      ok:
        type: boolean
        default: false
      code:
        type: string
        default: "DBERROR"
      message:
        type: string
 
  AllFoodItems:
    type: array
    items:
      $ref: '#/definitions/FoodItem'

  FoodItem:
    type: object
    properties:
      foodItemID:
        type: integer
        format: int64
      description:
        type: string
      displayAs:
        type: string
      coarseFoodGroup:
        type: string
      fineFoodGroup:
        type: string
      longDescription:
        type: string
      unitOfMeasure:
        type: string

  AllFoodGroups:
    type: array
    items:
      $ref: '#/definitions/FoodGroup'

  FoodGroup:
    type: object
    properties:
      foodGroupID:
        type: string
      description:
        type: string
      isFineFoodGroup:
        type: boolean
      isCoarseFoodGroup:
        type: boolean

  AllHealthConditions:
    type: array
    items:
      $ref: '#/definitions/HealthCondition'
  
  HealthCondition:
    type: object
    properties:
      healthConditionID:
        type: number
      description:
        type: string
      longDescription:
        type: string
      AKA:
        type: string

  GoodFor:
    type: object
    properties:
      descriptionNumericID:
        type: number
      description:
        type: string
      notes:
        type: string
      value:
        type: number

  AllSuggests:
    type: array
    items:
      $ref: '#/definitions/Suggest'
      
  TopItems:
    type: object
    properties:
      description:
        type: string
      value:
        type: number
      foodItemID:
        type: number
      displayAs:
        type: string
      notes:
        type: string

  Detailed:
    type: object
    properties:
      foodItemID:
        type: number
      foodItemDisplayAs:
        type: string
      healthConditionID:
        type: number
      description:
        type: string
      notes:
        type: string
      value:
        type: number


  Suggest:
    type: object
    properties:
      foodItemID:
        type: number
      foodItemDisplayAs:
        type: string
      value:
        type: number
      foodDescription:
        type: string
      description:
        type: string
      descriptionNumericID:
        type: number
      notes:
        type: string